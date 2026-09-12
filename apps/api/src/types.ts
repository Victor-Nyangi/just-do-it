export type Env = {
  DB: D1Database;
  CLERK_SECRET_KEY: string;
  ALLOWED_ORIGINS: string;
};

export type EnrollmentRow = {
  id: string;
  journeyId: string;
  startDate: string;
  createdAt: string;
};

export type CompletionRow = {
  id: string;
  enrollmentId: string;
  dayIndex: number;
  activityId: string;
  completedAt: string;
};

export type StateResponse = {
  enrollments: EnrollmentRow[];
  completions: CompletionRow[];
};

// Everything past authentication is handed a user id that came from a verified
// token, never from the request. The type exists so that a handler cannot be
// written that forgets to take one.
export type AuthenticatedRequest = {
  userId: string;
  request: Request;
  env: Env;
};

export type { TokenVerifier } from './auth';
