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

All of this is CLI already — there is no dashboard step. You need a Cloudflare account (free, no
card).

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

Clerk shipped an official CLI in April 2026, so this step does not have to be done in the
dashboard.

```sh
npm install -g clerk        # or: brew install clerk/stable/clerk
clerk login
clerk apps                  # create / list / select an application
clerk env pull              # writes the keys into a local env file
```

Useful too: `clerk link` ties this directory to an application, `clerk doctor` checks the
integration, and `clerk api` reaches the Backend API directly.

**Three things to check after `clerk env pull`:**

1. **The publishable key must be named `VITE_CLERK_PUBLISHABLE_KEY`.** Vite only exposes
   variables with the `VITE_` prefix to browser code; anything else is invisible at runtime and
   fails silently. Rename it if the CLI wrote a bare `CLERK_PUBLISHABLE_KEY`.
2. **Move the secret key out.** If the pull wrote `CLERK_SECRET_KEY` into the app's env file, it
   belongs to the Worker instead — `wrangler secret put CLERK_SECRET_KEY`, then delete the line.
   It is not bundled (no `VITE_` prefix, so Vite never exposes it) and `.gitignore` covers
   `.env*`, but a full-access credential should not sit in the frontend's config regardless.
3. **Never let a secret key get a `VITE_` prefix.** That is the one mistake that turns it public.

> `clerk init` also exists and goes further — it detects the framework, installs the SDK, and
> scaffolds the provider wiring. That is a reasonable shortcut, but it will edit `main.tsx` and
> add a dependency, which overlaps with the frontend work still to come. Either run it and expect
> the generated code to be reshaped to match this repo's conventions, or stop at `clerk env pull`
> and leave the wiring alone.

**`clerk deploy` does not remove the DNS requirement.** It walks an application from development
to production, but a production instance still needs a domain you control — see below.

<details>
<summary>Dashboard equivalent</summary>

1. Sign up at [clerk.com](https://clerk.com) and create an application.
2. Choose sign-in methods. Since this is your personal tracker, **GitHub or Google alone is
   plenty** — you do not need email/password.
3. From **API keys**, copy both:
   - **Publishable key** (`pk_test_…` / `pk_live_…`) — safe in the browser, goes to Vercel.
   - **Secret key** (`sk_test_…` / `sk_live_…`) — **never** in the browser or in git.

</details>

### Development instance or production instance?

This is the one Clerk decision that is not obvious, and getting it wrong wastes an afternoon.

Clerk gives every application two separate instances. They do **not** share user data, so an
account created on one does not exist on the other.

|                   | Development (`pk_test_`)                                     | Production (`pk_live_`)                           |
| ----------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Runs on           | localhost **and** a host-provided domain like `*.vercel.app` | Only a domain you control                         |
| Domain setup      | None                                                         | Add the domain in Clerk, then add its DNS records |
| OAuth credentials | Clerk's shared ones                                          | Your own, per provider                            |
| User cap          | 100                                                          | Your plan's limit                                 |

**While the app lives on `*.vercel.app`, use the development instance.** A production instance
cannot run there: Clerk verifies authentication requests through DNS records on your domain, and
you cannot add DNS records to `vercel.app`. This is a documented limitation, not a misconfiguration
to debug.

For a personal tracker that is completely fine — the 100-user cap is 99 more than you need, and
shared OAuth credentials only matter when other people sign in. The visible cost is a
development-mode indicator from Clerk.

**When you want `pk_live_`,** you need a custom domain first: point e.g. `journey.yourdomain.com`
at Vercel, add it in Clerk's **Domains** page, and add the DNS records it gives you. Worth doing
eventually for a portfolio piece, but it is a separate errand and nothing here depends on it.
Remember that your development-instance account will not carry over — with one user, that is one
more sign-in, not a migration.

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

**This list does double duty.** It is also passed to Clerk as `authorizedParties`, which checks
that a token was minted for one of your origins — without it, a token issued for your app can be
replayed from another site on the same device. So an origin missing here fails twice: CORS blocks
the call, and the token would be rejected even if it did not. Add a deploy origin once and both
are covered.

---

## 5. Vercel — environment variables

```sh
npm install -g vercel
vercel link                                       # once, to connect this directory
vercel env add VITE_CLERK_PUBLISHABLE_KEY production
vercel env add VITE_API_URL production
vercel env ls                                     # confirm
vercel --prod --force                             # env changes do NOT redeploy on their own
```

That last line is the one people miss. Adding a variable never redeploys anything, and Vite bakes
these in **at build time** — so an existing deployment keeps the values it was built with until
you force a new build or push a commit.

Add `preview` alongside `production` on either command only if you want preview deployments
talking to the real API; see the note about preview origins above.

<details>
<summary>Dashboard equivalent</summary>

In the Vercel project → **Settings → Environment Variables**, add both:

| Name                         | Value                                     | Notes                                             |
| ---------------------------- | ----------------------------------------- | ------------------------------------------------- |
| `VITE_CLERK_PUBLISHABLE_KEY` | `pk_…` from Clerk                         | Publishable; ends up in the bundle, which is fine |
| `VITE_API_URL`               | your `workers.dev` URL, no trailing slash | e.g. `https://just-do-it-api.you.workers.dev`     |

Vite only exposes variables prefixed `VITE_`, and **inlines them at build time** — so after
adding or changing either one you must trigger a redeploy. Changing a variable does not update
an existing deployment.

</details>

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

## 7. Verifying it

The app has a diagnostics page at **`/settings`**. It reports what the build was configured with
and whether the pieces can reach each other, which is faster than guessing from a blank screen:

| Row          | What a healthy setup shows                                          |
| ------------ | ------------------------------------------------------------------- |
| Clerk key    | the `pk_…` prefix, not "not set"                                    |
| Instance     | `development` on a `*.vercel.app` URL                               |
| Clerk loaded | `yes` — if it stays "still loading", the browser cannot reach Clerk |
| Signed in    | your email once you have signed in                                  |
| Worker URL   | your `workers.dev` URL                                              |
| Health check | `reachable`, after pressing **Check the API**                       |

A failed health check names both causes it could be, because the browser reports them
identically: the Worker is unreachable, or this origin is missing from its `ALLOWED_ORIGINS`.

"not set" on a row whose variable you have definitely set almost always means the build predates
it — Vite inlines these, so redeploy.

## Checklist

- [ ] `wrangler login` done
- [ ] D1 created, `database_id` pasted into `wrangler.toml` and committed
- [ ] Migrations applied, remote and local
- [ ] Clerk application created (`clerk apps`, or the dashboard), sign-in method chosen
- [ ] Publishable key named `VITE_CLERK_PUBLISHABLE_KEY` — a bare `CLERK_PUBLISHABLE_KEY` is
      invisible to Vite
- [ ] `CLERK_SECRET_KEY` set via `wrangler secret put` (**not** committed)
- [ ] Worker deployed, `/api/health` returns `{"ok":true}`
- [ ] `ALLOWED_ORIGINS` includes the Vercel production origin, redeployed
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL` set in Vercel, then redeployed
- [ ] `/settings` shows the Clerk key, `Clerk loaded: yes`, and a reachable health check

---

## Things that will bite

- **Using `pk_live_` on a `*.vercel.app` URL.** It cannot work — production instances need DNS
  records on a domain you control. Use the development instance until you have a custom domain.
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
