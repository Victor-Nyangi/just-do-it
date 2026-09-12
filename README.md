# Just Do It

A personal productivity POC for seeing what matters, doing it, and checking it off.

Start with [`HANDOVER.md`](./HANDOVER.md) — what exists, why it is shaped that way,
and what is left. [`SETUP.md`](./SETUP.md) stands the API up, [`DEPLOY.md`](./DEPLOY.md)
covers Vercel.

## Workspace

- `apps/just-do-it` - React, Vite, Tailwind, and React Router application
- `apps/api` - Cloudflare Worker and D1 schema behind Clerk
- `packages/ui` - shared primitives, consumed as TypeScript source

## Development

```sh
pnpm install
pnpm dev
```

Use `pnpm build`, `pnpm lint`, and `pnpm typecheck` to validate the workspace.
