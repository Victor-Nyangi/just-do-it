# @just-do-it/api

A Cloudflare Worker backing the journeys feature: Clerk-authenticated, D1-stored.

Setup — accounts, keys, deploy — is in [`../../SETUP.md`](../../SETUP.md).

## What it stores

Journey **definitions** are not here. The repo stays authoritative for what a journey is, so that
editing `journeys.json` and deploying reaches a browser that already has data. This database holds
only what a person did about them.

| Table         | Key                                       |                                                   |
| ------------- | ----------------------------------------- | ------------------------------------------------- |
| `enrollments` | `id`                                      | Which journeys a user started, and from what date |
| `completions` | `(enrollment_id, day_index, activity_id)` | Which activities were ticked                      |

That composite key is the reason a toggle is safe to retry: the same request twice cannot produce
two rows. It matches the id the client derives, so a server read and a committed export agree.

## Endpoints

All require `Authorization: Bearer <clerk session token>` except `/api/health`.

| Method   | Path                      |                                                            |
| -------- | ------------------------- | ---------------------------------------------------------- |
| `GET`    | `/api/health`             | No auth. Tells a bad deploy apart from a bad token         |
| `GET`    | `/api/state`              | `{ enrollments, completions }` for the signed-in user      |
| `POST`   | `/api/completions/toggle` | `{ enrollmentId, dayIndex, activityId }` → `{ completed }` |
| `POST`   | `/api/enrollments`        | `{ journeyId, startDate }` → the created enrollment        |
| `DELETE` | `/api/enrollments/:id`    | Takes the enrollment's completions with it                 |

`user_id` is written from the verified token and never from a request body, and every query in
`db.ts` filters on it. A signed-in user cannot reach another user's enrollment by guessing its id;
that returns 404 rather than 403, so the response does not confirm the row exists.

## Commands

Run these from the repo root, or anywhere inside it — `--filter` resolves by package name.

```sh
pnpm --filter @just-do-it/api test
pnpm --filter @just-do-it/api dev             # local Worker + local D1
pnpm --filter @just-do-it/api db:migrate      # apply migrations to the real database
pnpm --filter @just-do-it/api run deploy      # `run` is required — see below
```

`deploy` is the one script that needs an explicit `run`: `pnpm deploy` is a built-in pnpm command
(deploy a workspace package to a target directory), so the bare form fails with
`ERR_PNPM_INVALID_DEPLOY_TARGET` rather than reaching wrangler.

## Tests

They run inside workerd against a real in-memory D1, applying the real migration files — so SQL
that Cloudflare would reject fails here rather than on first deploy. The Clerk verifier is
injected (`handleRequest` takes it as a parameter), which is what lets the whole surface be driven
without a live Clerk instance.

Two things worth knowing before changing the test setup:

- The `compatibility_date` in `wrangler.toml` and `vitest.config.ts` must be one the **bundled**
  workerd supports. A date newer than the binary makes the runtime refuse to boot, with an error
  that names both dates.
- Migrations are read in node and passed to the worker as a binding. workerd has no filesystem, so
  the test cannot read the `.sql` files itself.
