import { NextResponse, type NextRequest } from 'next/server';

/**
 * Public routes that do not require an active authenticated session.
 */
const PUBLIC_PATHS = ['/login', '/auth', '/api/health', '/_next', '/favicon.ico'];

/**
 * Edge middleware protecting CRM routes and propagating correlation IDs.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip public and static assets
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublic) {
    return NextResponse.next();
  }

  // 2. Propagate or generate correlation ID
  const correlationId =
    request.headers.get('x-correlation-id') ||
    `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);

  // 3. Inspect Supabase authentication session cookies
  // Supabase stores access tokens in cookies named 'sb-<ref>-auth-token' or standard 'sb-access-token'
  const hasAuthCookie = Array.from(request.cookies.getAll()).some(
    (cookie) =>
      cookie.name.includes('auth-token') ||
      cookie.name.includes('access-token') ||
      cookie.name === 'vynor_session',
  );

  // In production, unauthenticated requests to protected paths redirect to /login
  if (!hasAuthCookie && pathname !== '/' && !pathname.startsWith('/api')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
