import type { Env } from './types';

// One list, two jobs: which origins a browser may call this Worker from, and
// which origins a Clerk token may have been minted for. They are the same set,
// so they are parsed in one place rather than drifting apart.
//
// Trailing slashes are stripped because an `Origin` header never has one, while
// the URL a person copies out of a browser bar always does. Left as an exact
// match, `https://example.app/` in the config silently matches nothing, and the
// failure surfaces as an opaque CORS error plus a rejected token — two symptoms,
// no clue. Case is normalised for the same reason: the scheme and host of an
// origin are case-insensitive, but a string compare is not.
export function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, '').toLowerCase())
    .filter(Boolean);
}

// The API is called from a browser on a different origin to the Worker, so
// every response needs CORS headers — including the error ones, or the browser
// reports an opaque network failure instead of the status.
export function resolveAllowedOrigin(env: Env, requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;

  // Compared normalised, but echoed back exactly as the browser sent it —
  // `Access-Control-Allow-Origin` has to match the request's own origin.
  const normalized = requestOrigin.trim().replace(/\/+$/, '').toLowerCase();

  return parseAllowedOrigins(env).includes(normalized) ? requestOrigin : null;
}

export function corsHeaders(allowedOrigin: string | null): Record<string, string> {
  if (!allowedOrigin) return {};

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    // Without this a proxy could serve one origin's preflight to another.
    Vary: 'Origin',
  };
}

export function jsonResponse(
  body: unknown,
  status: number,
  allowedOrigin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(allowedOrigin) },
  });
}

export function errorResponse(
  message: string,
  status: number,
  allowedOrigin: string | null,
): Response {
  return jsonResponse({ error: message }, status, allowedOrigin);
}
