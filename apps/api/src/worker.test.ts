import { env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleRequest } from './index';
import { resetDatabase } from './test-setup';
import type { Env, TokenVerifier } from './types';

const ORIGIN = 'https://app.example';
const ALICE = 'user_alice';
const BOB = 'user_bob';

// The verifier is injected so the whole surface can be driven without a live
// Clerk instance: the token string here *is* the user id.
const fakeVerifier = async (token: string) => (token.startsWith('user_') ? token : null);

const NOW = new Date('2026-09-12T09:00:00.000Z');

function call(
  path: string,
  init: RequestInit & { token?: string | null; origin?: string | null } = {},
): Promise<Response> {
  const { token = ALICE, origin = ORIGIN, ...requestInit } = init;
  const headers = new Headers(requestInit.headers);

  if (origin) headers.set('Origin', origin);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (requestInit.body) headers.set('Content-Type', 'application/json');

  return handleRequest(
    new Request(`https://api.example${path}`, { ...requestInit, headers }),
    env as unknown as Env,
    fakeVerifier as TokenVerifier,
    NOW,
  );
}

async function createEnrollment(token = ALICE, journeyId = 'hundred-day-discipline') {
  const response = await call('/api/enrollments', {
    method: 'POST',
    token,
    body: JSON.stringify({ journeyId, startDate: '2026-09-11' }),
  });

  return (await response.json()) as { id: string };
}

beforeEach(async () => {
  await resetDatabase();
});

describe('health', () => {
  it('answers without a token, so a deploy can be checked', async () => {
    const response = await call('/api/health', { token: null });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});

describe('authentication', () => {
  it('refuses a request with no bearer token', async () => {
    expect((await call('/api/state', { token: null })).status).toBe(401);
  });

  it('refuses a token the verifier rejects', async () => {
    expect((await call('/api/state', { token: 'nonsense' })).status).toBe(401);
  });

  it('does not say why a token was refused', async () => {
    const body = (await (await call('/api/state', { token: 'nonsense' })).json()) as {
      error: string;
    };

    expect(body.error).toBe('Invalid or expired token');
  });
});

describe('CORS', () => {
  it('answers a preflight for an allowed origin', async () => {
    const response = await call('/api/state', { method: 'OPTIONS', token: null });

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('does not echo an origin that is not on the list', async () => {
    const response = await call('/api/state', { origin: 'https://evil.example' });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  // Without CORS headers on the error too, the browser reports an opaque
  // network failure and the real status is invisible.
  it('carries CORS headers on a 401 as well', async () => {
    const response = await call('/api/state', { token: null });

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });
});

describe('GET /api/state', () => {
  it('starts a new user with nothing', async () => {
    const response = await call('/api/state');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ enrollments: [], completions: [] });
  });

  it('returns what the user has started', async () => {
    await createEnrollment();

    const body = (await (await call('/api/state')).json()) as {
      enrollments: { journeyId: string; startDate: string }[];
    };

    expect(body.enrollments).toHaveLength(1);
    expect(body.enrollments[0]).toMatchObject({
      journeyId: 'hundred-day-discipline',
      startDate: '2026-09-11',
    });
  });

  // The whole point of scoping every query on the verified user id.
  it('never shows one user another user’s rows', async () => {
    const alice = await createEnrollment(ALICE);
    await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({ enrollmentId: alice.id, dayIndex: 1, activityId: 'day-1-reflection' }),
    });

    const body = (await (await call('/api/state', { token: BOB })).json()) as {
      enrollments: unknown[];
      completions: unknown[];
    };

    expect(body.enrollments).toEqual([]);
    expect(body.completions).toEqual([]);
  });
});

describe('POST /api/completions/toggle', () => {
  it('ticks an activity and reports it complete', async () => {
    const enrollment = await createEnrollment();

    const response = await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        dayIndex: 1,
        activityId: 'day-1-reflection',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ completed: true });
  });

  it('unticks the same activity on a second call', async () => {
    const enrollment = await createEnrollment();
    const body = JSON.stringify({
      enrollmentId: enrollment.id,
      dayIndex: 1,
      activityId: 'day-1-reflection',
    });

    await call('/api/completions/toggle', { method: 'POST', body });
    const response = await call('/api/completions/toggle', { method: 'POST', body });

    await expect(response.json()).resolves.toMatchObject({ completed: false });
  });

  it('derives the completion id from the natural key', async () => {
    const enrollment = await createEnrollment();

    await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        dayIndex: 4,
        activityId: 'day-4-growth-reading',
      }),
    });

    const body = (await (await call('/api/state')).json()) as {
      completions: { id: string }[];
    };

    expect(body.completions[0].id).toBe(`${enrollment.id}:4:day-4-growth-reading`);
  });

  it('records when it was ticked', async () => {
    const enrollment = await createEnrollment();

    await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        dayIndex: 1,
        activityId: 'day-1-reflection',
      }),
    });

    const body = (await (await call('/api/state')).json()) as {
      completions: { completedAt: string }[];
    };

    expect(body.completions[0].completedAt).toBe(NOW.toISOString());
  });

  // A signed-in user must not be able to tick somebody else's enrollment by
  // guessing its id. 404 rather than 403, so the answer does not confirm that
  // the enrollment exists.
  it('refuses an enrollment belonging to another user', async () => {
    const alice = await createEnrollment(ALICE);

    const response = await call('/api/completions/toggle', {
      method: 'POST',
      token: BOB,
      body: JSON.stringify({ enrollmentId: alice.id, dayIndex: 1, activityId: 'day-1-reflection' }),
    });

    expect(response.status).toBe(404);
  });

  it('refuses an enrollment that does not exist', async () => {
    const response = await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({ enrollmentId: 'nope', dayIndex: 1, activityId: 'day-1-reflection' }),
    });

    expect(response.status).toBe(404);
  });

  it('rejects a malformed body', async () => {
    const enrollment = await createEnrollment();

    for (const body of [
      '{}',
      'not json',
      JSON.stringify({ enrollmentId: enrollment.id, dayIndex: 0, activityId: 'x' }),
      JSON.stringify({ enrollmentId: enrollment.id, dayIndex: 1.5, activityId: 'x' }),
      JSON.stringify({ enrollmentId: enrollment.id, dayIndex: 1, activityId: '' }),
    ]) {
      expect((await call('/api/completions/toggle', { method: 'POST', body })).status).toBe(400);
    }
  });
});

describe('enrollments', () => {
  it('creates one and gives it a server-side id', async () => {
    const response = await call('/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ journeyId: 'deep-work-reset', startDate: '2026-10-01' }),
    });

    expect(response.status).toBe(201);

    const body = (await response.json()) as { id: string; createdAt: string };

    expect(body.id).toMatch(/[0-9a-f-]{36}/);
    expect(body.createdAt).toBe(NOW.toISOString());
  });

  it('rejects a start date that is not a calendar date', async () => {
    const response = await call('/api/enrollments', {
      method: 'POST',
      body: JSON.stringify({ journeyId: 'x', startDate: 'next tuesday' }),
    });

    expect(response.status).toBe(400);
  });

  // Completions belong to the enrollment, so leaving takes its history with it
  // rather than stranding orphan rows.
  it('takes the completions with it when deleted', async () => {
    const enrollment = await createEnrollment();

    await call('/api/completions/toggle', {
      method: 'POST',
      body: JSON.stringify({
        enrollmentId: enrollment.id,
        dayIndex: 1,
        activityId: 'day-1-reflection',
      }),
    });

    expect((await call(`/api/enrollments/${enrollment.id}`, { method: 'DELETE' })).status).toBe(
      200,
    );

    await expect((await call('/api/state')).json()).resolves.toEqual({
      enrollments: [],
      completions: [],
    });
  });

  it('refuses to delete another user’s enrollment', async () => {
    const alice = await createEnrollment(ALICE);

    expect(
      (await call(`/api/enrollments/${alice.id}`, { method: 'DELETE', token: BOB })).status,
    ).toBe(404);

    const body = (await (await call('/api/state')).json()) as { enrollments: unknown[] };

    expect(body.enrollments).toHaveLength(1);
  });
});

describe('routing', () => {
  it('404s an unknown path', async () => {
    expect((await call('/api/nope')).status).toBe(404);
  });

  it('404s a known path under the wrong method', async () => {
    expect((await call('/api/state', { method: 'POST' })).status).toBe(404);
  });
});
