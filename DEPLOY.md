# Deploying to Vercel

Covers the two Phase 14 deploy bullets: a Vercel project for `apps/just-do-it`, and the SPA
rewrite so deep links survive a hard refresh. This is a click-through reference for the Vercel
dashboard — it does not re-derive anything, just states the values.

## Project settings (dashboard → Project → Settings → Build and Deployment)

This is a pnpm + Turborepo monorepo with one deployable app. Import the GitHub repo
(`Victor-Nyangi/just-do-it`) as a single Vercel project with these settings:

| Setting              | Value                                                     |
| -------------------- | --------------------------------------------------------- |
| **Root Directory**   | `apps/just-do-it`                                         |
| **Framework Preset** | Vite (auto-detected once Root Directory is set)           |
| **Build Command**    | `turbo run build`                                         |
| **Output Directory** | `dist`                                                    |
| **Install Command**  | leave on the auto-detected default                        |
| **Node.js Version**  | `22.x` (dashboard → Settings → General → Node.js Version) |

Notes on why, so nothing here needs re-deriving:

- **Root Directory = `apps/just-do-it`.** Vercel also looks for `vercel.json` inside the Root
  Directory once it's set, which is why `vercel.json` in this repo lives at
  `apps/just-do-it/vercel.json`, not the repo root.
- **Build Command = `turbo run build`.** This is Vercel's documented recommendation for a
  Turborepo monorepo (turbo ≥1.8, this repo pins `^2.7.2`): with Root Directory set, turbo's
  "automatic workspace scoping" infers the right `--filter` from the cwd, so the plain command
  is enough — no explicit `--filter=@just-do-it/app` needed. Turbo runs `^build` first, which
  covers `@just-do-it/ui#build` (a no-op `tsc --noEmit` type-check; it declares no `outputs` in
  `turbo.json` since the app consumes `packages/ui/src` directly, not a compiled `dist`), then
  `@just-do-it/app#build` (`tsc -b && vite build`). `turbo.json` already declares this shape
  correctly — nothing to change there.
- **Install Command left on auto-detect.** Vercel reads the root `package.json`'s
  `"packageManager": "pnpm@10.33.0"` and the root `pnpm-lock.yaml`, and installs from the repo
  root (not the Root Directory) so pnpm workspace linking between `apps/just-do-it` and
  `packages/ui` resolves correctly. Overriding this is unnecessary.
- **Output Directory = `dist`, not `apps/just-do-it/dist`.** Vite's output directory is always
  relative to the app's own package root, and Root Directory already scopes Vercel into
  `apps/just-do-it` for this setting. Verified by running `pnpm build --force` locally: output
  landed at `apps/just-do-it/dist/{index.html, assets/, favicon.svg, icons.svg}`.
- **Node 22.x** matches `.nvmrc` (`22`), which is also what CI's `actions/setup-node` reads via
  `node-version-file: .nvmrc`. Keeping Vercel on the same major avoids a divergent build
  environment from CI.

## Skipping unnecessary builds (`packages/ui` changes)

No `ignoreCommand` or custom Ignored Build Step is needed. Vercel's automatic "skip unaffected
projects" feature already applies correctly here, because the workspace meets its requirements:
pnpm workspaces via `pnpm-workspace.yaml`, unique `name` fields (`@just-do-it/app`,
`@just-do-it/ui`), and the dependency declared explicitly (`@just-do-it/ui: "workspace:*"` in
`apps/just-do-it/package.json`).

That dependency is exactly why a `packages/ui`-only change should **not** be skipped: the app
imports `packages/ui/src` as raw TypeScript source (no compiled `dist`, see `CLAUDE.md`'s design
system section), so any change there can change the app's build output. Vercel's dependency-graph
detection already treats the app as "changed" whenever `packages/ui` changes, which is the correct
behavior — do not add an `ignoreCommand` that special-cases `packages/ui` out, or a real UI change
will silently fail to redeploy. If a custom Ignored Build Step is ever wanted for other reasons,
the documented Turborepo-specific one is:

```
npx turbo-ignore --fallback=HEAD^1
```

but nothing here currently requires it.

## Environment variables

**None.** The app has no backend and no build-time configuration: it seeds Zustand stores from
local JSON fixtures parsed through Zod at import time (see `CLAUDE.md`'s data-flow section).
Verified with `grep -rn "import.meta.env\|process.env" apps/just-do-it/src apps/just-do-it/vite.config.ts packages/ui/src`
— no matches. Do not add placeholder env vars to the Vercel project; there is nothing to wire up.

## SPA rewrite (deep-link 404s)

`apps/just-do-it/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Why a catch-all like this doesn't also swallow static assets: Vercel's documented rewrite
semantics check the filesystem (the built output — `index.html`, `assets/*.js`, `assets/*.css`,
`favicon.svg`, `icons.svg`) **before** applying any rewrite. A request for a file that exists in
the Output Directory is served directly; the rewrite to `/index.html` only fires for paths with
no matching file — i.e. exactly the client-side routes. (Vercel's own docs on the `rewrites`
`source` property: "precedence is given to the filesystem prior to rewrites being applied.") No
narrower regex excluding `/assets/` was needed or used, and none should be added.

The app's real routes, enumerated from `apps/just-do-it/src/App.tsx` (`react-router-dom`'s
`Routes`/`Route` config) rather than assumed:

- `/today`
- `/tasks`
- `/calendar`
- `/goals`
- `/habits`
- `/habits/:habitId`
- `/books`
- `/lists`
- `/lists/:listId`
- `/settings` (still `<PlaceholderPage>`, but routed)
- any other path redirects client-side to `/today`

All of these are pure client routes with no corresponding static file, so they all fall through
to the rewrite and get the app shell, which then lets React Router resolve the real page —
including a hard refresh or a typed-in URL on `/lists/:listId`.

**What this does not prove:** `vite preview` (used locally to eyeball the app — `vite dev` doesn't
work on this machine, see `CLAUDE.md`) implements SPA fallback natively regardless of
`vercel.json`, so a working deep link under `vite preview` is not evidence the Vercel rewrite is
correct. The rewrite above was verified by inspection against Vercel's documented rewrite
semantics, not by an actual Vercel deployment — there is no live Vercel project to deploy to yet.
