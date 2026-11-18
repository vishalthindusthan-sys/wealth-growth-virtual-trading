/**
 * Admin sign-in for the /admin area.
 *
 * Deliberately independent of Supabase: the platform admin must be able to get
 * in and look at feed health even when the database is not configured, and the
 * admin session must never be derivable from a normal user session.
 *
 * The session is a signed cookie: base64url(payload).base64url(HMAC-SHA256).
 * Built on Web Crypto so the exact same code runs in the Edge middleware and
 * in Node route handlers.
 */

export const ADMIN_COOKIE = 'wg_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60; // 8 hours

export interface AdminSession {
  /** Admin user id (ADMIN_USER_ID). */
  sub: string;
  email: string;
  name: string;
  role: 'admin';
  /** Issued at / expires at, epoch seconds. */
  iat: number;
  exp: number;
}

export interface AdminIdentity {
  id: string;
  email: string;
  name: string;
}

function env(name: string) {
  return (process.env[name] || '').trim();
}

/** Admin sign-in is available only when all four values are configured. */
export function isAdminConfigured() {
  return (
    env('ADMIN_USER_ID').length > 0 &&
    env('ADMIN_EMAIL').length > 0 &&
    env('ADMIN_PASSWORD').length >= 8 &&
    env('ADMIN_SESSION_SECRET').length >= 16
  );
}

export function adminIdentity(): AdminIdentity {
  return {
    id: env('ADMIN_USER_ID'),
    email: env('ADMIN_EMAIL'),
    name: env('ADMIN_NAME') || 'Administrator',
  };
}

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function hmac(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('ADMIN_SESSION_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return toBase64Url(new Uint8Array(signature));
}

/** Length-independent constant-time string compare. */
function safeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  let diff = left.length ^ right.length;
  const max = Math.max(left.length, right.length);
  for (let i = 0; i < max; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

export async function verifyPassword(candidate: string) {
  // Compared in constant time so a wrong password cannot be found character by
  // character from response timing.
  return safeEqual(candidate, env('ADMIN_PASSWORD'));
}

export async function createSessionCookie() {
  const identity = adminIdentity();
  const now = Math.floor(Date.now() / 1000);
  const session: AdminSession = {
    sub: identity.id,
    email: identity.email,
    name: identity.name,
    role: 'admin',
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };

  const payload = toBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  const signature = await hmac(payload);

  return {
    value: `${payload}.${signature}`,
    maxAge: SESSION_TTL_SECONDS,
    session,
  };
}

export async function readSession(cookieValue: string | undefined): Promise<AdminSession | null> {
  if (!cookieValue || !isAdminConfigured()) return null;

  const [payload, signature] = cookieValue.split('.');
  if (!payload || !signature) return null;

  const expected = await hmac(payload);
  if (!safeEqual(signature, expected)) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as AdminSession;
    if (session.role !== 'admin') return null;
    if (typeof session.exp !== 'number' || session.exp * 1000 < Date.now()) return null;
    // A session signed for a different admin id (rotated credentials) is dead.
    if (session.sub !== env('ADMIN_USER_ID')) return null;
    return session;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ *
 * Sign-in throttling (per process, resets on restart).
 * ------------------------------------------------------------------ */

const attempts = new Map<string, { count: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function registerFailedAttempt(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now - entry.first > WINDOW_MS) {
    attempts.set(key, { count: 1, first: now });
    return;
  }
  entry.count += 1;
}

export function isThrottled(key: string) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) {
    attempts.delete(key);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function clearAttempts(key: string) {
  attempts.delete(key);
}
