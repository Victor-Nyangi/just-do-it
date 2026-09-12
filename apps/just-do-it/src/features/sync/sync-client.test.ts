// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  SyncRequestError,
  createRemoteEnrollment,
  deleteRemoteEnrollment,
  fetchSyncedState,
  pushToggle,
} from './sync-client';

// The suite runs against a build with no VITE_API_URL — Vite inlines it, so a
// test cannot change it. That is fine here: every request is intercepted, and
// what is being pinned is the request shape and the error handling, not the
// host.
const token = async () => 'a-token';
const noToken = async () => null;

function mockFetch(implementation: (input: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(implementation);

  vi.stubGlobal('fetch', spy);

  return spy;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authentication', () => {
  // Signed out is not an error state — it means "stay local". The null status
  // is what lets a caller tell it apart from a Worker that is down.
  it('refuses without a token, and says so with a null status', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({}));

    await expect(fetchSyncedState(noToken)).rejects.toBeInstanceOf(SyncRequestError);
    await expect(fetchSyncedState(noToken)).rejects.toMatchObject({ status: null });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends the token as a bearer header', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ enrollments: [], completions: [] }));

    await fetchSyncedState(token);

    const init = fetchSpy.mock.calls[0][1] as RequestInit;

    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer a-token');
  });
});

describe('fetchSyncedState', () => {
  it('returns what the API sent', async () => {
    const enrollment = {
      id: 'e1',
      journeyId: 'hundred-day-discipline',
      startDate: '2026-09-11',
      createdAt: '2026-09-11T06:00:00.000Z',
    };

    mockFetch(async () => jsonResponse({ enrollments: [enrollment], completions: [] }));

    await expect(fetchSyncedState(token)).resolves.toEqual({
      enrollments: [enrollment],
      completions: [],
    });
  });

  // An empty body must read as "this user has nothing yet", not as a crash.
  it('treats missing keys as empty rather than undefined', async () => {
    mockFetch(async () => jsonResponse({}));

    await expect(fetchSyncedState(token)).resolves.toEqual({ enrollments: [], completions: [] });
  });

  it('reports the status when the API refuses', async () => {
    mockFetch(async () => jsonResponse({ error: 'nope' }, 401));

    await expect(fetchSyncedState(token)).rejects.toMatchObject({ status: 401 });
  });

  // A blocked origin and an unreachable Worker are indistinguishable from the
  // browser, so the message names both instead of guessing.
  it('names both causes when the request never lands', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(fetchSyncedState(token)).rejects.toThrow(/ALLOWED_ORIGINS/);
  });
});

describe('pushToggle', () => {
  it('posts the triple the server keys on', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ completed: true }));

    await pushToggle(token, 'e1', 4, 'day-4-growth-reading');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/completions/toggle');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      enrollmentId: 'e1',
      dayIndex: 4,
      activityId: 'day-4-growth-reading',
    });
  });
});

describe('createRemoteEnrollment', () => {
  // The server owns enrollment identity, so the id comes back rather than
  // being sent — a completion written against a locally invented id would
  // point at nothing.
  it('returns the enrollment the server created', async () => {
    const created = {
      id: 'server-made-this',
      journeyId: 'deep-work-reset',
      startDate: '2026-10-01',
      createdAt: '2026-10-01T00:00:00.000Z',
    };

    mockFetch(async () => jsonResponse(created, 201));

    await expect(createRemoteEnrollment(token, 'deep-work-reset', '2026-10-01')).resolves.toEqual(
      created,
    );
  });

  it('does not send an id of its own', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ id: 'x' }, 201));

    await createRemoteEnrollment(token, 'deep-work-reset', '2026-10-01');

    expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      journeyId: 'deep-work-reset',
      startDate: '2026-10-01',
    });
  });
});

describe('deleteRemoteEnrollment', () => {
  it('deletes by id, encoded into the path', async () => {
    const fetchSpy = mockFetch(async () => jsonResponse({ deleted: true }));

    await deleteRemoteEnrollment(token, 'needs/encoding');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];

    expect(url).toContain('/api/enrollments/needs%2Fencoding');
    expect(init.method).toBe('DELETE');
  });
});
