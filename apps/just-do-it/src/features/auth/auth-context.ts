import { createContext } from 'react';

export type AuthSnapshot = {
  // False until Clerk has finished booting. Distinct from "signed out": a page
  // that treats loading as signed out flashes the wrong state on every reload.
  loaded: boolean;
  signedIn: boolean;
  userId: string | null;
  label: string | null;
};

export type AuthTokenGetter = () => Promise<string | null>;

// The defaults are what a build without a Clerk key gets, and they are the
// reason nothing here branches on `isClerkConfigured` at the point of use.
// `AuthProvider` either mounts a bridge that publishes real values, or leaves
// these in place — so every consumer calls `useContext` unconditionally and the
// rules of hooks hold without a suppression.
export const UNCONFIGURED_AUTH: AuthSnapshot = {
  loaded: true,
  signedIn: false,
  userId: null,
  label: null,
};

// Null rather than a throw: "there is no token" is the normal state for a
// signed-out visitor, not an error.
const NO_TOKEN: AuthTokenGetter = async () => null;

export const AuthSnapshotContext = createContext<AuthSnapshot>(UNCONFIGURED_AUTH);
export const AuthTokenContext = createContext<AuthTokenGetter>(NO_TOKEN);
