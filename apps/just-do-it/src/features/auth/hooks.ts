import { useContext } from 'react';

import { AuthSnapshotContext, AuthTokenContext } from './auth-context';
import type { AuthSnapshot, AuthTokenGetter } from './auth-context';

export function useAuthSnapshot(): AuthSnapshot {
  return useContext(AuthSnapshotContext);
}

// The bearer token the Worker verifies. Resolves to null when the app was built
// without Clerk, or when nobody is signed in — both of which mean "stay local"
// rather than "retry".
export function useAuthTokenGetter(): AuthTokenGetter {
  return useContext(AuthTokenContext);
}
