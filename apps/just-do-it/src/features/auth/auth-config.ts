// Clerk is configured through a build-time variable, so whether this app has
// auth at all is fixed the moment it is bundled. That is what makes the
// branching below safe: it never changes between renders, so components can be
// chosen on it without breaking the rules of hooks.
//
// Vite only exposes variables prefixed `VITE_`, and inlines them at build time.
// A key added to Vercel after a deploy does not reach that deploy — see
// SETUP.md.
const rawPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export const clerkPublishableKey =
  typeof rawPublishableKey === 'string' ? rawPublishableKey.trim() : '';

// The whole app must keep working without a key. A portfolio visitor who never
// signs in should see the committed record and be able to click around, and a
// missing variable must degrade to that rather than white-screening —
// `ClerkProvider` throws outright when handed an empty key.
export const isClerkConfigured = clerkPublishableKey.length > 0;

// `pk_test_` is a development instance: it works on localhost and on a
// host-provided domain like `*.vercel.app`, capped at 100 users and using
// Clerk's shared OAuth credentials. `pk_live_` requires a domain you control,
// because Clerk verifies through DNS records on it.
export function describeClerkInstance(publishableKey: string): 'development' | 'production' | null {
  if (publishableKey.startsWith('pk_test_')) return 'development';
  if (publishableKey.startsWith('pk_live_')) return 'production';

  return null;
}

// A secret key in a browser bundle is a full-access credential in public. It
// can only get there by being given a `VITE_` prefix, which is exactly the
// mistake worth shouting about rather than failing quietly.
export function looksLikeSecretKey(publishableKey: string): boolean {
  return publishableKey.startsWith('sk_');
}
