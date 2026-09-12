import { verifyToken } from '@clerk/backend';

import type { Env } from './types';

// Clerk issues a short-lived RS256 session token to the browser; the Worker
// verifies it rather than trusting anything the client says about who it is.
// This is the only place a user id enters the system — every handler receives
// it as an argument, so no route can accidentally read one from a request body.
export type TokenVerifier = (token: string, env: Env) => Promise<string | null>;

export function readBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization');

  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice('Bearer '.length).trim();

  return token.length > 0 ? token : null;
}

export const verifyClerkToken: TokenVerifier = async (token, env) => {
  try {
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });

    // `sub` is the Clerk user id. A token that verifies but carries no subject
    // is not something to guess about.
    return typeof payload.sub === 'string' && payload.sub.length > 0 ? payload.sub : null;
  } catch {
    // An expired, malformed, or wrongly-signed token is a 401, not a 500, and
    // the reason is deliberately not reported back to the caller.
    return null;
  }
};
