import type { CompletionRow, EnrollmentRow } from './types';

// Every query below filters on user_id, and that value always comes from the
// verified token. A missing filter here is a cross-tenant read, so they are
// written as one small module rather than inline in the handlers.

const COMPLETION_ID_SEPARATOR = ':';

// Mirrors the client's `toCompletionId`. The row's identity is its natural key,
// so the id never has to be stored — it is derived on the way out.
export function toCompletionId(enrollmentId: string, dayIndex: number, activityId: string): string {
  return [enrollmentId, dayIndex, activityId].join(COMPLETION_ID_SEPARATOR);
}

export async function selectEnrollments(db: D1Database, userId: string): Promise<EnrollmentRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, journey_id, start_date, created_at
       FROM enrollments
       WHERE user_id = ?
       ORDER BY created_at, id`,
    )
    .bind(userId)
    .all<{ id: string; journey_id: string; start_date: string; created_at: string }>();

  return results.map((row) => ({
    id: row.id,
    journeyId: row.journey_id,
    startDate: row.start_date,
    createdAt: row.created_at,
  }));
}

// Ordered by the same triple the client sorts its export by, so a state read
// and a committed file agree without the client having to re-sort.
export async function selectCompletions(db: D1Database, userId: string): Promise<CompletionRow[]> {
  const { results } = await db
    .prepare(
      `SELECT enrollment_id, day_index, activity_id, completed_at
       FROM completions
       WHERE user_id = ?
       ORDER BY enrollment_id, day_index, activity_id`,
    )
    .bind(userId)
    .all<{
      enrollment_id: string;
      day_index: number;
      activity_id: string;
      completed_at: string;
    }>();

  return results.map((row) => ({
    id: toCompletionId(row.enrollment_id, row.day_index, row.activity_id),
    enrollmentId: row.enrollment_id,
    dayIndex: row.day_index,
    activityId: row.activity_id,
    completedAt: row.completed_at,
  }));
}

export async function enrollmentBelongsToUser(
  db: D1Database,
  userId: string,
  enrollmentId: string,
): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS present FROM enrollments WHERE id = ? AND user_id = ?`)
    .bind(enrollmentId, userId)
    .first<{ present: number }>();

  return row !== null;
}

export async function insertEnrollment(
  db: D1Database,
  userId: string,
  enrollment: EnrollmentRow,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO enrollments (id, user_id, journey_id, start_date, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(enrollment.id, userId, enrollment.journeyId, enrollment.startDate, enrollment.createdAt)
    .run();
}

export async function deleteEnrollment(
  db: D1Database,
  userId: string,
  enrollmentId: string,
): Promise<void> {
  // Completions belong to the enrollment, so leaving takes its history with it
  // rather than stranding orphan rows — the same rule the client store follows.
  await db.batch([
    db
      .prepare(`DELETE FROM completions WHERE enrollment_id = ? AND user_id = ?`)
      .bind(enrollmentId, userId),
    db.prepare(`DELETE FROM enrollments WHERE id = ? AND user_id = ?`).bind(enrollmentId, userId),
  ]);
}

// Returns what the activity now is, so a caller needs one round trip rather
// than two. Toggling is idempotent per (enrollment, day, activity) because that
// triple is the primary key — a retried request cannot double-insert.
export async function toggleCompletion(
  db: D1Database,
  userId: string,
  enrollmentId: string,
  dayIndex: number,
  activityId: string,
  completedAt: string,
): Promise<{ completed: boolean }> {
  const existing = await db
    .prepare(
      `SELECT 1 AS present
       FROM completions
       WHERE enrollment_id = ? AND day_index = ? AND activity_id = ? AND user_id = ?`,
    )
    .bind(enrollmentId, dayIndex, activityId, userId)
    .first<{ present: number }>();

  if (existing) {
    await db
      .prepare(
        `DELETE FROM completions
         WHERE enrollment_id = ? AND day_index = ? AND activity_id = ? AND user_id = ?`,
      )
      .bind(enrollmentId, dayIndex, activityId, userId)
      .run();

    return { completed: false };
  }

  await db
    .prepare(
      `INSERT INTO completions (enrollment_id, day_index, activity_id, user_id, completed_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (enrollment_id, day_index, activity_id) DO NOTHING`,
    )
    .bind(enrollmentId, dayIndex, activityId, userId, completedAt)
    .run();

  return { completed: true };
}
