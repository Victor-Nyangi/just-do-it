# Supabase setup

The initial schema lives in `migrations/`. Apply it to a new Supabase project
with the Supabase CLI or the SQL editor, then generate types against that
project:

```sh
supabase db push
supabase gen types typescript --linked > apps/just-do-it/src/lib/supabase/database.types.ts
```

Set the project URL and publishable key in `apps/just-do-it/.env.local` from
the included `.env.example`. Never expose a `service_role` key to the Vite
application.

All application tables use Supabase Auth ownership and Row Level Security.
The browser client has access only to rows belonging to the authenticated user.
