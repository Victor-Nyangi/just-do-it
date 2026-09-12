import { fileURLToPath } from 'node:url';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

// The suite runs inside workerd with a real (in-memory) D1, so the SQL in
// `db.ts` and the migration file are genuinely exercised rather than mocked. A
// mock would happily accept SQL that Cloudflare rejects.
//
// Migrations are read here, in node, and handed to the worker as a binding:
// workerd has no filesystem, so the test cannot read the .sql file itself.
const migrations = await readD1Migrations(fileURLToPath(new URL('./migrations', import.meta.url)));

// `cloudflareTest` is a Vite plugin in @cloudflare/vitest-pool-workers 0.22+;
// earlier versions exported a `defineWorkersConfig` wrapper from a `./config`
// subpath that no longer exists. The compatibility date matches wrangler.toml
// and must be one the bundled workerd supports, or the runtime refuses to boot.
export default defineConfig({
  plugins: [
    cloudflareTest({
      singleWorker: true,
      miniflare: {
        compatibilityDate: '2026-08-22',
        compatibilityFlags: ['nodejs_compat'],
        d1Databases: { DB: 'test-db' },
        bindings: {
          TEST_MIGRATIONS: migrations,
          CLERK_SECRET_KEY: 'sk_test_not_used_the_verifier_is_injected',
          ALLOWED_ORIGINS: 'https://app.example,http://localhost:5173',
        },
      },
    }),
  ],
});
