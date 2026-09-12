import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useAuthSnapshot, useAuthTokenGetter } from '../auth';
import { useJourneyStore } from '../journeys';
import { fetchSyncedState } from './sync-client';
import { isApiConfigured } from './sync-config';
import { LOCAL_ONLY, SyncStatusContext } from './sync-context';
import type { SyncSnapshot } from './types';

// Hydrates the journey store from the server whenever somebody is signed in and
// this build has an API to talk to. Everything else — no key, no API URL,
// signed out — stays on the local record, which is the portfolio-visitor case
// and must keep working untouched.
//
// Signing in does not destroy the local record: `localStorage` still holds it,
// so signing out returns to it. The two are separate stores of the same shape,
// and which one is authoritative depends only on whether there is a session.
export function JourneySync({ children }: { children: ReactNode }) {
  const auth = useAuthSnapshot();
  const getToken = useAuthTokenGetter();
  const adoptServerState = useJourneyStore((state) => state.adoptServerState);
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(LOCAL_ONLY);

  // Guards against a late response from a previous session overwriting a newer
  // one — sign out and back in quickly and the first request can still land.
  const requestIdRef = useRef(0);

  const shouldSync = isApiConfigured && auth.loaded && auth.signedIn;

  const hydrate = useCallback(async () => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setSnapshot({ status: 'loading', error: null });

    try {
      const state = await fetchSyncedState(getToken);

      if (requestIdRef.current !== requestId) return;

      adoptServerState(state.enrollments, state.completions);
      setSnapshot({ status: 'synced', error: null });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      setSnapshot({
        status: 'failed',
        error: error instanceof Error ? error.message : 'Could not reach the API',
      });
    }
  }, [adoptServerState, getToken]);

  useEffect(() => {
    if (!shouldSync) {
      // Bumping the id abandons any response still in flight, so signing out
      // cannot be undone a second later by a request that was already sent.
      requestIdRef.current += 1;
      setSnapshot(LOCAL_ONLY);
      return;
    }

    void hydrate();
  }, [hydrate, shouldSync]);

  const value = useMemo(() => snapshot, [snapshot]);

  return <SyncStatusContext.Provider value={value}>{children}</SyncStatusContext.Provider>;
}
