import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'access_token';

// The cookie's presence does not validate the session. Redirecting logged-in users away from
// /login would cause an infinite loop when the token is invalid but the cookie is still alive.
// Let the app page handle post-login redirects instead.

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function middleware(request: NextRequest) {
  const hasAccessCookie = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (!hasAccessCookie && matchesPath(pathname, '/app')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
