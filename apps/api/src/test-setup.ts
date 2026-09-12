import { applyD1Migrations, env } from 'cloudflare:test';

// Applies the real migration files rather than a hand-copied schema, so a
// migration D1 would reject fails here rather than on first deploy.
export async function resetDatabase(): Promise<void> {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  await env.DB.prepare('DELETE FROM completions').run();
  await env.DB.prepare('DELETE FROM enrollments').run();
}
