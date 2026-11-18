import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, readSession } from '@/lib/adminAuth';
import { addAudit } from '@/lib/adminStore';

export async function POST(request: NextRequest) {
  const session = await readSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (session) {
    addAudit(session.email, 'admin.logout', 'Signed out of the admin panel');
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
