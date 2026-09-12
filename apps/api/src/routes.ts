import { z } from 'zod';

import {
  deleteEnrollment,
  enrollmentBelongsToUser,
  insertEnrollment,
  selectCompletions,
  selectEnrollments,
  toggleCompletion,
} from './db';
import { errorResponse, jsonResponse } from './http';
import type { Env, StateResponse } from './types';

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a YYYY-MM-DD date');

const toggleCompletionSchema = z.object({
  enrollmentId: z.string().min(1).max(200),
  dayIndex: z.number().int().min(1).max(1000),
  activityId: z.string().min(1).max(200),
});

const createEnrollmentSchema = z.object({
  journeyId: z.string().min(1).max(200),
  startDate: dateSchema,
});

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export type RouteContext = {
  userId: string;
  env: Env;
  now: Date;
  allowedOrigin: string | null;
};

export async function handleGetState(context: RouteContext): Promise<Response> {
  const [enrollments, completions] = await Promise.all([
    selectEnrollments(context.env.DB, context.userId),
    selectCompletions(context.env.DB, context.userId),
  ]);

  const body: StateResponse = { enrollments, completions };

  return jsonResponse(body, 200, context.allowedOrigin);
}

export async function handleToggleCompletion(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const parsed = toggleCompletionSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return errorResponse('Invalid request body', 400, context.allowedOrigin);
  }

  const { enrollmentId, dayIndex, activityId } = parsed.data;

  // Without this an authenticated user could tick activities on somebody
  // else's enrollment just by guessing its id. 404 rather than 403, so the
  // response does not confirm that the enrollment exists.
  if (!(await enrollmentBelongsToUser(context.env.DB, context.userId, enrollmentId))) {
    return errorResponse('Enrollment not found', 404, context.allowedOrigin);
  }

  const result = await toggleCompletion(
    context.env.DB,
    context.userId,
    enrollmentId,
    dayIndex,
    activityId,
    context.now.toISOString(),
  );

  return jsonResponse(
    { enrollmentId, dayIndex, activityId, ...result },
    200,
    context.allowedOrigin,
  );
}

export async function handleCreateEnrollment(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const parsed = createEnrollmentSchema.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return errorResponse('Invalid request body', 400, context.allowedOrigin);
  }

  const enrollment = {
    id: crypto.randomUUID(),
    journeyId: parsed.data.journeyId,
    startDate: parsed.data.startDate,
    createdAt: context.now.toISOString(),
  };

  await insertEnrollment(context.env.DB, context.userId, enrollment);

  return jsonResponse(enrollment, 201, context.allowedOrigin);
}

export async function handleDeleteEnrollment(
  enrollmentId: string,
  context: RouteContext,
): Promise<Response> {
  if (!(await enrollmentBelongsToUser(context.env.DB, context.userId, enrollmentId))) {
    return errorResponse('Enrollment not found', 404, context.allowedOrigin);
  }

  await deleteEnrollment(context.env.DB, context.userId, enrollmentId);

  return jsonResponse({ id: enrollmentId, deleted: true }, 200, context.allowedOrigin);
}
