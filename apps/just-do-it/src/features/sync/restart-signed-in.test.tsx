// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useJourneyStore } from '../journeys';
import { useSyncedRestartEnrollment } from './hooks';
import type { JourneyRestartResult } from './types';

// `VITE_API_URL` and the Clerk key are inlined by Vite, so no test can turn the
// signed-in path on through the environment. This file replaces the two seams
// that decide it — the build-time API config and the auth hooks — so the hook
// believes it is talking to a server, and every request is caught by a stubbed
// `fetch`. `hooks.test.tsx` covers the same hook on the real, local-only build.
vi.mock('./sync-config', () => ({
  apiUrl: 'https://api.test',
  isApiConfigured: true,
}));

vi.mock('../auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../auth')>();
  const getToken = async () => 'a-token';

  return {
    ...actual,
    useAuthSnapshot: () => ({ loaded: true, signedIn: true, userId: 'user-1', label: 'Victor' }),
    useAuthTokenGetter: () => getToken,
  };
});

const OLD_ID = 'enrollment-discipline';
const NEW_ID = 'server-issued-run';

type Call = { method: string; url: string; body: unknown };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Answers like the Worker does, but lets a test fail either half.
function stubServer({ failCreate = false, failDelete = false } = {}) {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = typeof init.body === 'string' ? JSON.parse(init.body) : null;

      calls.push({ method, url: input, body });

      if (method === 'POST' && input.endsWith('/api/enrollments')) {
        if (failCreate) return jsonResponse({ error: 'boom' }, 500);

        return jsonResponse(
          {
            id: NEW_ID,
            journeyId: body.journeyId,
            startDate: body.startDate,
            createdAt: '2026-11-19T09:00:00.000Z',
          },
          201,
        );
      }

      if (method === 'DELETE') {
        if (failDelete) return jsonResponse({ error: 'boom' }, 500);

        return jsonResponse({ id: OLD_ID, deleted: true });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    }),
  );

  return calls;
}

async function restart(enrollmentId: string, startDate: string): Promise<JourneyRestartResult> {
  const { result } = renderHook(() => useSyncedRestartEnrollment());
  let outcome: JourneyRestartResult | undefined;

  await act(async () => {
    outcome = await result.current(enrollmentId, startDate);
  });

  if (!outcome) throw new Error('Expected the restart to settle');

  return outcome;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useSyncedRestartEnrollment while signed in', () => {
  it('asks the server for the new run before deleting the old one', async () => {
    const calls = stubServer();

    await restart(OLD_ID, '2026-11-02');

    expect(calls.map((call) => call.method)).toEqual(['POST', 'DELETE']);
    expect(calls[0]).toMatchObject({
      url: 'https://api.test/api/enrollments',
      body: { journeyId: 'hundred-day-discipline', startDate: '2026-11-02' },
    });
    expect(calls[1].url).toBe(`https://api.test/api/enrollments/${OLD_ID}`);
  });

  // The server owns enrollment identity, so the id the caller navigates to is
  // the one the server issued, not a locally invented one.
  it('adopts the server-issued run and drops the old one with its ticks', async () => {
    stubServer();

    const outcome = await restart(OLD_ID, '2026-11-02');

    expect(outcome).toEqual({ status: 'restarted', enrollmentId: NEW_ID });

    const state = useJourneyStore.getState();

    expect(state.enrollments.map((entry) => entry.id)).toEqual([NEW_ID]);
    expect(state.enrollments[0].startDate).toBe('2026-11-02');
    expect(state.completions).toEqual([]);
  });

  it('leaves the old run untouched when the new one cannot be created', async () => {
    const calls = stubServer({ failCreate: true });
    const before = useJourneyStore.getState();

    const outcome = await restart(OLD_ID, '2026-11-02');

    expect(outcome).toEqual({ status: 'not-restarted' });
    expect(calls.map((call) => call.method)).toEqual(['POST']);
    expect(useJourneyStore.getState().enrollments).toEqual(before.enrollments);
    expect(useJourneyStore.getState().completions).toEqual(before.completions);
  });

  // Worst case by design: both runs exist, which the server already permits.
  // The local record keeps the old run too, so it does not vanish and then
  // reappear on the next hydration.
  it('reports an old run it could not remove, keeping both', async () => {
    stubServer({ failDelete: true });
    const completionsBefore = useJourneyStore.getState().completions;

    const outcome = await restart(OLD_ID, '2026-11-02');

    expect(outcome).toEqual({ status: 'old-run-kept', enrollmentId: NEW_ID });

    const state = useJourneyStore.getState();

    expect(state.enrollments.map((entry) => entry.id)).toEqual([OLD_ID, NEW_ID]);
    expect(state.completions).toEqual(completionsBefore);
  });
});
