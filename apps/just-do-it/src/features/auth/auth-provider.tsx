import { ClerkProvider, useAuth, useUser } from '@clerk/clerk-react';
import { useCallback, useMemo, type ReactNode } from 'react';

import { clerkPublishableKey, isClerkConfigured, looksLikeSecretKey } from './auth-config';
import { AuthSnapshotContext, AuthTokenContext, type AuthSnapshot } from './auth-context';

// Clerk's hooks only work inside a `ClerkProvider`, so they are called here —
// in a component that only ever mounts when there is a key — and the result is
// published through context. That is what lets every consumer read auth
// unconditionally instead of branching on configuration at the call site.
function ClerkAuthBridge({ children }: { children: ReactNode }) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const snapshot = useMemo<AuthSnapshot>(
    () => ({
      loaded: isLoaded,
      signedIn: Boolean(isSignedIn),
      userId: userId ?? null,
      label: user?.primaryEmailAddress?.emailAddress ?? user?.username ?? null,
    }),
    [isLoaded, isSignedIn, userId, user],
  );

  const tokenGetter = useCallback(async () => {
    try {
      // Clerk session tokens are short-lived, so this is called per request
      // rather than cached. A cached one starts failing about a minute in.
      return await getToken();
    } catch {
      return null;
    }
  }, [getToken]);

  return (
    <AuthSnapshotContext.Provider value={snapshot}>
      <AuthTokenContext.Provider value={tokenGetter}>{children}</AuthTokenContext.Provider>
    </AuthSnapshotContext.Provider>
  );
}

export function SecretKeyLeaked() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-8">
      <div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-subtle)] p-6">
        <h1 className="text-lg font-bold text-[var(--danger)]">Secret key in the browser</h1>
        <p className="mt-3 text-sm">
          <code>VITE_CLERK_PUBLISHABLE_KEY</code> holds a value starting <code>sk_</code>. That is a
          Clerk <strong>secret</strong> key, and Vite inlines every <code>VITE_</code> variable into
          the JavaScript it ships &mdash; so this build has published a full-access credential.
        </p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm">
          <li>Rotate the secret key in the Clerk dashboard now. It must be treated as public.</li>
          <li>
            Set <code>VITE_CLERK_PUBLISHABLE_KEY</code> to the publishable key, which starts{' '}
            <code>pk_</code>.
          </li>
          <li>
            Give the secret key to the Worker instead:{' '}
            <code>wrangler secret put CLERK_SECRET_KEY</code>.
          </li>
          <li>Rebuild and redeploy &mdash; Vite bakes these in at build time.</li>
        </ol>
      </div>
    </div>
  );
}

// Wraps the app in Clerk only when there is a key to do it with. Without one
// the children render untouched and the contexts keep their defaults, so the
// app is exactly what it was before auth existed: fixtures plus localStorage,
// which is the right thing for a visitor who never signs in.
export function AuthProvider({ children }: { children: ReactNode }) {
  if (!isClerkConfigured) return <>{children}</>;

  // By the time this renders the key is already in the bundle, so this cannot
  // un-leak it — the job is to make the mistake impossible to miss, because a
  // silent success leaves a full-access credential public indefinitely. An
  // error page rather than a thrown error: a throw gives a blank screen and a
  // console message, which is easy to scroll past on a deployed site.
  if (looksLikeSecretKey(clerkPublishableKey)) return <SecretKeyLeaked />;

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkAuthBridge>{children}</ClerkAuthBridge>
    </ClerkProvider>
  );
}
