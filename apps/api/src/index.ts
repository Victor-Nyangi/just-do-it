import { readBearerToken, verifyClerkToken, type TokenVerifier } from './auth';
import { corsHeaders, errorResponse, jsonResponse, resolveAllowedOrigin } from './http';
import {
  handleCreateEnrollment,
  handleDeleteEnrollment,
  handleGetState,
  handleToggleCompletion,
  type RouteContext,
} from './routes';
import type { Env } from './types';

const DELETE_ENROLLMENT_PATTERN = /^\/api\/enrollments\/([^/]+)$/;

// The verifier is a parameter rather than an import so the routing and the
// database work can be driven in tests without a live Clerk instance. Production
// always gets the real one, from the default export below.
export async function handleRequest(
  request: Request,
  env: Env,
  verifyToken: TokenVerifier = verifyClerkToken,
  now: Date = new Date(),
): Promise<Response> {
  const url = new URL(request.url);
  const allowedOrigin = resolveAllowedOrigin(env, request.headers.get('Origin'));

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(allowedOrigin) });
  }

  // Unauthenticated on purpose: something has to be curl-able to tell "the
  // Worker is deployed and bound to a database" from "my token is wrong".
  if (url.pathname === '/api/health') {
    return jsonResponse({ ok: true }, 200, allowedOrigin);
  }

  const token = readBearerToken(request);

  if (!token) {
    return errorResponse('Missing bearer token', 401, allowedOrigin);
  }

  const userId = await verifyToken(token, env);

  if (!userId) {
    return errorResponse('Invalid or expired token', 401, allowedOrigin);
  }

  const context: RouteContext = { userId, env, now, allowedOrigin };

  if (url.pathname === '/api/state' && request.method === 'GET') {
    return handleGetState(context);
  }

  if (url.pathname === '/api/completions/toggle' && request.method === 'POST') {
    return handleToggleCompletion(request, context);
  }

  if (url.pathname === '/api/enrollments' && request.method === 'POST') {
    return handleCreateEnrollment(request, context);
  }

  const deleteMatch = DELETE_ENROLLMENT_PATTERN.exec(url.pathname);

  if (deleteMatch && request.method === 'DELETE') {
    return handleDeleteEnrollment(decodeURIComponent(deleteMatch[1]), context);
  }

  return errorResponse('Not found', 404, allowedOrigin);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return await handleRequest(request, env);
    } catch (error) {
      // A thrown error would otherwise reach the browser as an opaque CORS
      // failure, because the default error response carries no CORS headers.
      console.error('Unhandled error', error);

      return errorResponse(
        'Internal error',
        500,
        resolveAllowedOrigin(env, request.headers.get('Origin')),
      );
    }
  },
};
