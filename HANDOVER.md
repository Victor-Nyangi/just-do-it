# Handover — the hundred-day journey, live

Written 12 September 2026, at the point where the tracker went from a fixture-backed
POC to something actually running in public with a backend behind it.

This is the orientation document: what exists, why it is shaped the way it is, and
what to do next. The operational detail lives elsewhere and is not repeated here —
[`SETUP.md`](./SETUP.md) for standing the API up, [`DEPLOY.md`](./DEPLOY.md) for
Vercel, [`apps/api/README.md`](./apps/api/README.md) for the Worker,
[`CLAUDE.md`](./CLAUDE.md) for the architecture rules that must not be broken.

---

## Where things stand

|                  |                                                                      |
| ---------------- | -------------------------------------------------------------------- |
| Seeded run       | Day 1 = **12 Sep 2026**, day 100 = **20 Dec 2026**                   |
| Signed-in record | Cloudflare D1, synced across devices                                 |
| Public record    | `apps/just-do-it/src/data/journey-completions.json` — currently `[]` |
| Auth             | Clerk, development instance (`pk_test_…`)                            |
| Worker           | Deployed, origin normalisation live                                  |
| Tests            | 719 app across 44 files, 31 worker                                   |
| `main`           | `bcc7a4b`                                                            |

The published record is deliberately behind the live one. Progress ticked while
signed in lives in D1; making it public is a separate, manual act (see
[The publish loop](#the-publish-loop)).

---

## What was built

### The domain: journeys, not a challenge

The original ask was a single hard-coded 100-day challenge. It was generalised
before any of it shipped, into a **three-part model** that is the thing worth
understanding first:

- a **journey** is a definition — what a day looks like, how many days there are —
  and deliberately carries **no start date**;
- an **enrollment** is someone running that journey from a given date;
- **completions** hang off the enrollment.

That split is what lets the same journey be started twice, or by two people,
without the runs colliding. It is also why every selector takes an
`EnrolledJourney` pair rather than a journey.

Day plans are **generated, not stored**. `journey-plan.ts` derives them purely from
the definition and the day index: the physical rotation by `(dayIndex - 1) % 7`,
and each track's book by a seeded Fisher-Yates permutation reshuffled per cycle, so
every book comes up exactly once per pass while still looking shuffled. That
determinism is load-bearing rather than decorative — a completion row points at an
activity id like `day-4-growth-reading`, so a plan that changed between renders
would silently re-point it.

### The backend

Cloudflare Workers + D1, behind Clerk. Chosen over Supabase (ruled out) and AWS
Lambda (heavier than this needs) because the workload is a handful of small reads
and writes with no scheduling and no long-running work.

D1 stores **only what a person did** — `enrollments` and `completions`. Journey
definitions stay in the repo, so editing `journeys.json` and deploying reaches a
browser that already has state. `completions` is keyed on
`(enrollment_id, day_index, activity_id)`, which is what makes a toggle safe to
retry.

### The sync seam

`features/sync` is the only feature that imports other features, and the direction
is the whole point: **sync → journeys and sync → auth, never back**.
`features/journeys` knows nothing about auth or the API, which is what keeps it
usable with no server at all.

Three rules fell out of building it, each the resolution of something that actually
broke:

- **The server owns enrollment identity.** Enrolment round-trips and the returned
  row is adopted. Letting the client choose the id was tried and reverted —
  `enrollments.id` is a global primary key, so a client-chosen id collides across
  users and 500s.
- **Toggling is optimistic.** A checklist that waited for a round trip feels broken
  on a phone, and the server's toggle is idempotent on the triple, so a retry
  cannot double it.
- **Signing in does not destroy the local record.** `localStorage` still holds it,
  so signing out returns to it. Which one is authoritative depends only on whether
  there is a session.

With no `VITE_API_URL`, no Clerk key, or nobody signed in, every synced hook falls
through to the plain store action and **makes no request at all**. That is the
portfolio-visitor path and any deploy with a missing variable, and it must stay
transparent.

### Auth

Whether this app has auth is a **build-time constant** — Vite inlines
`VITE_CLERK_PUBLISHABLE_KEY`, so `isClerkConfigured` never changes between renders.
Without a key the app is exactly what it was before auth existed.

Clerk's hooks only work inside a `ClerkProvider`, and calling them conditionally
breaks the rules of hooks. The resolution is `auth-context.ts`: a bridge component
mounts only when there is a key, calls the hooks, and publishes a snapshot through
context. **Do not collapse that back into a conditional hook call with a lint
suppression.**

---

## The publish loop

The deployed site is static, so the browser cannot write back to the repo —
`src/data/*.json` is bundled into the JavaScript at build time. Publishing is
therefore a deliberate act:

1. Open the streak page **signed in**: `/journeys/<enrollment-id>/streak`. Reach it
   through `/journeys`; `enrollment-discipline` only exists in the repo, not in D1.
2. **Copy file contents** on the "Publish today's progress" card.
3. Paste over `apps/just-do-it/src/data/journey-completions.json`, replacing
   everything. Commit.

**Cadence is free.** The export is full current state, not a diff, so a weekly
commit carries everything since the last one and nothing accumulates or is lost.
Waiting also means the commit records where you actually ended up rather than every
intermediate wobble.

Three things make that loop trustworthy, and they must be preserved together:

- **Deterministic ids.** Completion ids are derived from
  `(enrollmentId, dayIndex, activityId)` rather than `crypto.randomUUID()` — a
  deliberate exception to the ID convention, and the same triple used as the D1
  primary key.
- **Canonical order.** The export is sorted by that triple and the committed file is
  already in that order, so committing an unchanged day diffs to nothing.
- **Re-keying.** The run a browser is ticking almost never carries the committed
  enrollment id. `JourneyExportCard` maps its completions onto the committed id
  before copying. Exporting the raw store instead writes completions pointing at an
  unknown enrollment, which the referential check in `journey-data.ts` throws on
  **at module load** — the paste would white-screen the deployed app on boot rather
  than fail a render.

---

## Two traps that cost real time

**`journey-completions.json` is a record, not a fixture.** It is the one data file
the app exists to change. The test suite used to seed the journey store straight
from it, so committing a real day's progress broke 27 tests — CI going red as a
direct consequence of using the product. Tests now seed from a fixed baseline in
`src/test/journey-baseline.ts`, and the suites that must touch the real record
assert invariants over it rather than its rows. **Keep it that way.**

**A squash merge leaves the branch conflicting with its own merged work.** `main`
takes the change under a new commit while the branch still carries the original —
same tree, unrelated history, so git reports a conflict across every file both
touched. Worse, a conflicted PR cannot have its merge ref built, so GitHub Actions
never schedules CI at all: the symptom is not a red check but _no check_. Prefer a
rebase merge (which is what the history convention here already assumes), or start
each branch fresh from `main`.

---

## What is not done

Nothing below is blocking; all of it is known and deliberate.

- **No retry queue.** A failed sync push is silently swallowed —
  `useSyncedToggleActivity` catches and discards. The tick shows locally and then
  vanishes on the next hydration. Surfacing a per-tick error needs somewhere to put
  it, which is the queue that does not exist yet. This is the most likely source of
  a confusing "my tick disappeared" report.
- **Clerk is on a development instance.** A production instance (`pk_live_…`)
  requires DNS on a domain you control, so `*.vercel.app` cannot use one. Revisit
  with a custom domain.
- **No journey editor.** Journeys are authored by editing `journeys.json`. The
  authenticated dashboard for saving custom journeys was scoped but not built.
- **Reading tracks are hardcoded** to `technical` and `growth`.
- **`HabitDayGrid` is inaccessible** — `aria-hidden` on its root with completion
  encoded purely as a background colour. Untestable by role or name, and unreadable
  to a screen reader. See the plan's debt list.
- **`src/data/dashboard.ts` is dead code** — nothing imports it.

---

## Picking this up cold

```sh
pnpm install
pnpm dev          # http://localhost:5173 — pinned, will not drift
pnpm test         # 719 + 31
```

Without `.env.local` you get the portfolio-visitor experience: fixtures plus
localStorage, no auth, no API. That path is the one that must never break, so it is
also the right place to start reading.

Then, in order: `CLAUDE.md` for the rules,
`apps/just-do-it/src/features/journeys/` for the domain, `features/sync/hooks.ts`
for the seam between it and the server.
