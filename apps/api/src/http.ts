import type { Env } from './types';

// The API is called from a browser on a different origin to the Worker, so
// every response needs CORS headers — including the error ones, or the browser
// reports an opaque network failure instead of the status.
export function resolveAllowedOrigin(env: Env, requestOrigin: string | null): string | null {
  if (!requestOrigin) return null;

  const allowed = env.ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return allowed.includes(requestOrigin) ? requestOrigin : null;
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
