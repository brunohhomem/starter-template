import { NextResponse, type NextRequest } from 'next/server';

const ACCESS_COOKIE = 'access_token';

// Login, cadastro e esqueci a senha não consomem token de e-mail.
// Confirmar, redefinir e aceitar convite precisam abrir mesmo com cookie:
// a presença do access token não valida a sessão, e o redirect apagaria o token da URL.
const LOGGED_IN_REDIRECT_PATHS = ['/login', '/register', '/forgot-password'];

function matchesPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function middleware(request: NextRequest) {
  const hasAccessCookie = Boolean(request.cookies.get(ACCESS_COOKIE)?.value);
  const { pathname } = request.nextUrl;

  if (hasAccessCookie && LOGGED_IN_REDIRECT_PATHS.some((path) => matchesPath(pathname, path))) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

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
