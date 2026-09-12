import { apiUrl } from './sync-config';
import type { SyncedState } from './types';

export type TokenGetter = () => Promise<string | null>;

// Thrown for anything the caller might reasonably tell a person about. The
// status is carried so that "you are signed out" (401) can be distinguished
// from "the Worker is down" (everything else) without parsing a message.
export class SyncRequestError extends Error {
  readonly status: number | null;

  constructor(message: string, status: number | null) {
    super(message);
    this.name = 'SyncRequestError';
    this.status = status;
  }
}

async function request(
  path: string,
  getToken: TokenGetter,
  init: RequestInit = {},
): Promise<unknown> {
  const token = await getToken();

  // No token means signed out or a build without Clerk. Neither is an error to
  // report — it means "stay local" — so it is distinguishable by status null.
  if (!token) throw new SyncRequestError('Not signed in', null);

  let response: Response;

  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch (error) {
    // A cross-origin block and an unreachable Worker are indistinguishable from
    // the browser — both surface as a bare network failure — so the message
    // names both rather than guessing.
    throw new SyncRequestError(
      `${error instanceof Error ? error.message : 'Request failed'}. The API is unreachable, or this origin is missing from its ALLOWED_ORIGINS.`,
      null,
    );
  }

  if (!response.ok) {
    throw new SyncRequestError(`The API answered ${response.status}`, response.status);
  }

  return response.json();
}

export async function fetchSyncedState(getToken: TokenGetter): Promise<SyncedState> {
  const body = (await request('/api/state', getToken)) as Partial<SyncedState> | null;

  return {
    enrollments: body?.enrollments ?? [],
    completions: body?.completions ?? [],
  };
}

export async function pushToggle(
  getToken: TokenGetter,
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
): Promise<void> {
  await request('/api/completions/toggle', getToken, {
    method: 'POST',
    body: JSON.stringify({ enrollmentId, dayIndex, activityId }),
  });
}

// The server owns enrollment identity, so this returns the row it created
// rather than the caller inventing an id and hoping they agree.
export async function createRemoteEnrollment(
  getToken: TokenGetter,
  journeyId: string,
  startDate: string,
): Promise<SyncedState['enrollments'][number]> {
  return (await request('/api/enrollments', getToken, {
    method: 'POST',
    body: JSON.stringify({ journeyId, startDate }),
  })) as SyncedState['enrollments'][number];
}

export async function deleteRemoteEnrollment(
  getToken: TokenGetter,
  enrollmentId: string,
): Promise<void> {
  await request(`/api/enrollments/${encodeURIComponent(enrollmentId)}`, getToken, {
    method: 'DELETE',
  });
}
