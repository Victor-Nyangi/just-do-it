import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';

import { Button } from '@just-do-it/ui';
import { isClerkConfigured } from '../auth-config';

// Clerk's hooks and control components throw outside a `ClerkProvider`, so this
// splits on the same build-time constant the provider does. The constant cannot
// change between renders, so choosing a component on it is safe.
function ClerkSignInControl() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <Button variant="secondary">Sign in</Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              // Matches the avatar the header used before auth existed, so the
              // layout does not jump when a page loads signed in.
              avatarBox: 'size-9',
            },
          }}
        />
      </SignedIn>
    </>
  );
}

// Stands in for the header avatar when the app was built without a Clerk key.
// Not a sign-in prompt: there is nothing to sign in to.
function UnconfiguredAvatar() {
  return (
    <div
      aria-hidden="true"
      className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-subtle)] text-sm font-bold text-[var(--accent)]"
    >
      V
    </div>
  );
}

export function SignInControl() {
  return isClerkConfigured ? <ClerkSignInControl /> : <UnconfiguredAvatar />;
}
