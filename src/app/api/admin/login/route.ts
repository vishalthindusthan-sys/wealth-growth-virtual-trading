import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  adminIdentity,
  clearAttempts,
  createSessionCookie,
  isAdminConfigured,
  isThrottled,
  registerFailedAttempt,
  verifyPassword,
} from '@/lib/adminAuth';
import { addAudit } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        error:
          'Admin sign-in is not configured. Set ADMIN_USER_ID, ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET.',
      },
      { status: 503 }
    );
  }

  // Throttle per client so the password cannot be brute-forced.
  const clientKey =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';

  if (isThrottled(clientKey)) {
    addAudit(clientKey, 'admin.login.throttled', 'Too many failed sign-in attempts');
    return NextResponse.json(
      { error: 'Too many failed attempts. Try again in a few minutes.' },
      { status: 429 }
    );
  }

  let email = '';
  let password = '';
  try {
    const body = await request.json();
    email = String(body?.email ?? '');
    password = String(body?.password ?? '');
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const identity = adminIdentity();
  const emailMatches = email.trim().toLowerCase() === identity.email.toLowerCase();
  const passwordMatches = await verifyPassword(password);

  if (!emailMatches || !passwordMatches) {
    registerFailedAttempt(clientKey);
    addAudit(clientKey, 'admin.login.failed', `Rejected sign-in for ${email || '(blank)'}`);
    // One message for both cases, so it does not reveal which half was wrong.
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  clearAttempts(clientKey);
  const cookie = await createSessionCookie();
  addAudit(identity.email, 'admin.login', 'Signed in to the admin panel');

  const response = NextResponse.json({
    ok: true,
    admin: { id: identity.id, email: identity.email, name: identity.name, role: 'admin' },
    expiresAt: new Date(cookie.session.exp * 1000).toISOString(),
  });

  response.cookies.set(ADMIN_COOKIE, cookie.value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: cookie.maxAge,
  });

  return response;
}
