// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthProvider, SecretKeyLeaked } from './auth-provider';
import { UNCONFIGURED_AUTH } from './auth-context';
import { SignInControl } from './components/sign-in-control';
import { useAuthSnapshot, useAuthTokenGetter } from './hooks';

// These run against a build with no `VITE_CLERK_PUBLISHABLE_KEY`, which is the
// state that matters most: a visitor who never signs in, and any deploy where
// the variable was missing at build time. `ClerkProvider` throws on an empty
// key, so "the app still works" is a real risk rather than a formality.
function AuthReadout() {
  const snapshot = useAuthSnapshot();

  return <p>{snapshot.signedIn ? 'signed in' : 'signed out'}</p>;
}

function TokenReadout({ onToken }: { onToken: (token: string | null) => void }) {
  const getToken = useAuthTokenGetter();

  return (
    <button
      onClick={() => {
        void getToken().then(onToken);
      }}
      type="button"
    >
      Get token
    </button>
  );
}

describe('AuthProvider without a Clerk key', () => {
  it('renders its children rather than throwing', () => {
    render(
      <AuthProvider>
        <p>The app</p>
      </AuthProvider>,
    );

    expect(screen.getByText('The app')).toBeInTheDocument();
  });

  it('reports signed out, and loaded rather than pending', () => {
    render(
      <AuthProvider>
        <AuthReadout />
      </AuthProvider>,
    );

    expect(screen.getByText('signed out')).toBeInTheDocument();
    expect(UNCONFIGURED_AUTH.loaded).toBe(true);
  });

  // Null is the normal answer for a signed-out visitor, not an error — the
  // sync layer reads it as "stay local" rather than "retry".
  it('resolves the token getter to null', async () => {
    const seen: (string | null)[] = [];

    render(
      <AuthProvider>
        <TokenReadout onToken={(token) => seen.push(token)} />
      </AuthProvider>,
    );

    screen.getByRole('button', { name: 'Get token' }).click();
    await Promise.resolve();

    expect(seen).toEqual([null]);
  });
});

describe('the auth hooks outside any provider', () => {
  // The contexts carry defaults, so a component that reads auth does not have
  // to care whether a provider is above it. Without that, every consumer would
  // need its own guard.
  it('fall back to the unconfigured snapshot', () => {
    render(<AuthReadout />);

    expect(screen.getByText('signed out')).toBeInTheDocument();
  });
});

describe('SignInControl without a Clerk key', () => {
  // Clerk's own control components throw outside a ClerkProvider, so this is
  // the guard that keeps the header rendering on an unconfigured build.
  it('renders a placeholder rather than a sign-in button', () => {
    render(<SignInControl />);

    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('the leaked-secret-key page', () => {
  // `AuthProvider` chooses this on a build-time constant, which a test cannot
  // change — Vite inlines it. So the component is rendered directly, and
  // `looksLikeSecretKey` (the branch condition) is covered in
  // auth-config.test.ts. Together those pin both halves of the guard.
  it('names the mistake and puts rotation first', () => {
    render(<SecretKeyLeaked />);

    expect(screen.getByRole('heading', { name: 'Secret key in the browser' })).toBeInTheDocument();

    const steps = screen.getAllByRole('listitem').map((item) => item.textContent ?? '');

    expect(steps[0]).toMatch(/Rotate the secret key/);
    expect(steps.join(' ')).toMatch(/wrangler secret put CLERK_SECRET_KEY/);
  });
});
