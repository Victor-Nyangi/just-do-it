# Setting up the API (Cloudflare Workers + D1 + Clerk)

Everything here is a one-time account-and-dashboard task that has to be done by a person with
the logins. The code is already in `apps/api`; this is what it needs from you before it runs.

**Where this leaves the app in the meantime:** nothing below is required for the site to work.
Signed out, the app reads the committed fixtures and keeps your ticks in `localStorage`, exactly
as it does today. The API only changes what happens once you are signed in.

Expect 20–30 minutes. Free tier throughout — D1 gives 5 GB and 5 million row reads a day, and
Clerk's free tier is 10,000 monthly active users. This app is one user.

---

## 1. Cloudflare — create the database

You need a Cloudflare account (free, no card).

```sh
pnpm install
pnpm --filter @just-do-it/api exec wrangler login     # opens a browser
pnpm --filter @just-do-it/api exec wrangler d1 create just-do-it
```

The last command prints a block like:

```toml
[[d1_databases]]
binding = "DB"
database_name = "just-do-it"
database_id = "a1b2c3d4-...."
```

Copy the `database_id` into `apps/api/wrangler.toml`, replacing
`REPLACE_WITH_YOUR_D1_DATABASE_ID`. It is **not** a secret — committing it is fine and expected.

Then create the tables:

```sh
pnpm --filter @just-do-it/api db:migrate          # remote (the real database)
pnpm --filter @just-do-it/api db:migrate:local    # local, for `wrangler dev`
```

---

## 2. Clerk — create the application

1. Sign up at [clerk.com](https://clerk.com) and create an application.
2. Choose sign-in methods. Since this is your personal tracker, **GitHub or Google alone is
   plenty** — you do not need email/password.
3. From **API keys**, copy both:
   - **Publishable key** (`pk_test_…` / `pk_live_…`) — safe in the browser, goes to Vercel.
   - **Secret key** (`sk_test_…` / `sk_live_…`) — **never** in the browser or in git.

Hand the secret key to the Worker:

```sh
pnpm --filter @just-do-it/api exec wrangler secret put CLERK_SECRET_KEY
# paste the sk_… value when prompted
```

`wrangler secret` stores it encrypted on Cloudflare. It is never written to the repo, and
`wrangler.toml` deliberately has no line for it.

---

## 3. Deploy the Worker

```sh
pnpm --filter @just-do-it/api deploy
```

Wrangler prints the URL, something like
`https://just-do-it-api.<your-subdomain>.workers.dev`. Check it:

```sh
curl https://just-do-it-api.<your-subdomain>.workers.dev/api/health
# {"ok":true}
```

That endpoint needs no token on purpose — it tells "the Worker is deployed and bound to a
database" apart from "my token is wrong", which are otherwise the same 401.

---

## 4. Tell the Worker which origins may call it

A browser will not let a page on `your-app.vercel.app` call the Worker unless the Worker says
that origin is allowed. Edit `ALLOWED_ORIGINS` in `apps/api/wrangler.toml` — comma-separated, no
spaces needed, no trailing slash:

```toml
[vars]
ALLOWED_ORIGINS = "http://localhost:5173,http://localhost:4173,https://your-app.vercel.app"
```

Then redeploy (`pnpm --filter @just-do-it/api deploy`).

**Vercel preview deployments get a different subdomain per branch**, so previews will not be able
to call the API unless you add them. That is usually the right trade-off: previews talking to
your real data is rarely what you want.

If a request fails in the browser with an opaque CORS or "network" error and `/api/health` works
from curl, this list is the first thing to check.

---

## 5. Vercel — environment variables

In the Vercel project → **Settings → Environment Variables**, add both:

| Name                         | Value                                     | Notes                                             |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_…` from Clerk                         | Publishable; ends up in the bundle, which is fine |
| `VITE_API_URL`               | your `workers.dev` URL, no trailing slash | e.g. `https://just-do-it-api.you.workers.dev`     |

Vite only exposes variables prefixed `VITE_`, and **inlines them at build time** — so after
adding or changing either one you must trigger a redeploy. Changing a variable does not update
an existing deployment.

> `DEPLOY.md` currently says this project has no environment variables. That was true before the
> API existed; these two are the first.

---

## 6. Running it locally

```sh
pnpm --filter @just-do-it/api dev     # Worker on http://localhost:8787, local D1
pnpm dev                              # app on http://localhost:5173
```

For the local app to talk to the local Worker, put this in `apps/just-do-it/.env.local`
(git-ignored):

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_…
VITE_API_URL=http://localhost:8787
```

`wrangler dev` uses a local SQLite file, not your real D1 — experiment freely.

---

## Checklist

- [ ] `wrangler login` done
- [ ] D1 created, `database_id` pasted into `wrangler.toml` and committed
- [ ] Migrations applied, remote and local
- [ ] Clerk application created, sign-in method chosen
- [ ] `CLERK_SECRET_KEY` set via `wrangler secret put` (**not** committed)
- [ ] Worker deployed, `/api/health` returns `{"ok":true}`
- [ ] `ALLOWED_ORIGINS` includes the Vercel production origin, redeployed
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL` set in Vercel, then redeployed

---

## Things that will bite

- **A secret key in the browser.** `pk_` is publishable and belongs in the frontend; `sk_` is a
  full-access credential. If an `sk_` value ever reaches a `VITE_` variable or a commit, rotate
  it in the Clerk dashboard immediately — anything in a client bundle on a public site is public,
  and deleting the commit does not undo that.
- **Forgetting to redeploy after changing a Vite variable.** They are baked in at build time.
- **`wrangler d1 migrations apply` without `--remote`.** It defaults to local, so the real
  database silently stays empty. `db:migrate` in `package.json` passes `--remote`; `db:migrate:local`
  is the other one.
- **Eventual failure modes look like CORS.** An unhandled 500 in the Worker would reach the
  browser as an opaque network error if the error response carried no CORS headers, which is why
  `src/index.ts` wraps everything and attaches them to errors too. If you add routes, keep that.

## What the API stores, and what it does not

Journey **definitions** are not in the database. The repo stays authoritative for what a journey
is — the client merges fixture definitions over stored state, so editing `journeys.json` and
deploying reaches a browser that already has data. D1 holds only what a person _did_: which
journeys they started, and which activities they ticked.

`user_id` is written from the verified Clerk token and never from a request body, and every query
filters on it. A signed-in user cannot read or tick another user's enrollment even by guessing
its id — `apps/api/src/worker.test.ts` covers exactly that.
