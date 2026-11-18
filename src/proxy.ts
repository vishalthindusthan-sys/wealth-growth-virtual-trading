import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, readSession } from '@/lib/adminAuth';

/**
 * Next.js 16 proxy (the former middleware convention).
 * Keeps normal users out of /admin and /api/admin. The session cookie is
 * HMAC-verified here (Web Crypto, so it runs on the Edge runtime); every admin
 * route verifies it again, so a bypass of this layer alone grants nothing.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminApi = pathname.startsWith('/api/admin');
  const isAdminPage = pathname.startsWith('/admin');

  // The sign-in endpoints must stay reachable without a session.
  if (pathname === '/admin/login' || pathname === '/api/admin/login' || pathname === '/api/admin/logout') {
    return NextResponse.next();
  }

  if (!isAdminApi && !isAdminPage) {
    return NextResponse.next();
  }

  const session = await readSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (session) {
    return NextResponse.next();
  }

  if (isAdminApi) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const loginUrl = new URL('/admin/login', request.url);
  loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
