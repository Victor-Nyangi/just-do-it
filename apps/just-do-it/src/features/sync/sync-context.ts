import { createContext } from 'react';

import type { SyncSnapshot } from './types';

// 'local' is the honest default: a build with no API, or nobody signed in, is
// not "failed" — it is working exactly as designed, with progress in this
// browser and published by commit.
export const LOCAL_ONLY: SyncSnapshot = { status: 'local', error: null };

export const SyncStatusContext = createContext<SyncSnapshot>(LOCAL_ONLY);
