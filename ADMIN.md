# Admin panel

The admin area lives at `/admin`, with sign-in at `/admin/login`. It is deliberately
**separate from Supabase user accounts**: the platform administrator must be able to
check feed health and platform settings even when the database is unavailable, and an
admin session can never be obtained by signing up as a normal user.

## Environment variables

Set these in `.env.local` for local runs, and in the Vercel project settings for the
deployed site. `.env*` is gitignored, so no credential is ever committed.

| Variable | Purpose |
| --- | --- |
| `ADMIN_USER_ID` | The admin user id (UUID). Shown in the panel and stamped into every session; changing it invalidates existing sessions. |
| `ADMIN_EMAIL` | The email used to sign in. |
| `ADMIN_NAME` | Display name in the panel. Optional, defaults to `Administrator`. |
| `ADMIN_PASSWORD` | The sign-in password. Minimum 8 characters. |
| `ADMIN_SESSION_SECRET` | HMAC key for the session cookie. Minimum 16 characters; use 32+ random bytes. |

Generate fresh values with:

```bash
node -e "const c=require('crypto');console.log('ADMIN_USER_ID='+c.randomUUID());console.log('ADMIN_PASSWORD='+c.randomBytes(9).toString('base64url'));console.log('ADMIN_SESSION_SECRET='+c.randomBytes(32).toString('base64url'))"
```

If any value is missing, `/admin` renders a "not configured" notice and sign-in returns
503 — it never falls back to an open page.

## How access control works

1. `src/proxy.ts` (the Next.js 16 proxy, formerly middleware) matches `/admin/:path*` and
   `/api/admin/:path*`, HMAC-verifies the session cookie on the Edge runtime, and
   redirects to `/admin/login` (pages) or returns 401 (APIs).
2. Every admin route handler and the `/admin` page verify the session again, so bypassing
   the proxy alone grants nothing.
3. The session cookie `wg_admin_session` is `httpOnly`, `sameSite=lax`, `secure` in
   production, signed with HMAC-SHA256 and valid for 8 hours.
4. Sign-in is throttled to 8 failed attempts per client per 10 minutes, and the password
   is compared in constant time. Wrong email and wrong password return the same message.

## What the panel shows

- **Signed-in admin**: id, email, role, session expiry, environment.
- **Platform tiles**: feed status, snapshots served and failed provider requests since
  restart, instruments tracked, registered/active users (when Supabase is configured).
- **Market data management**: provider name and data kind, last snapshot time, quote
  cache state, last provider failures, plus controls to change the dashboard refresh
  interval (10–600s), change the simulated brokerage rate, force a provider refresh, and
  disable or enable the feed. The refresh interval and the kill switch take effect on
  `/live` immediately.
- **Users and database**: live counts from Supabase, or a clear "not configured" panel.
  User listing, role changes and activation need the `users`/`orders`/`positions` tables
  from `supabase_schema.sql`; they are hidden rather than shown with invented numbers.
- **Audit log**: the last 25 admin actions, each with actor, action and timestamp.

## Known limits

- Settings, feed counters and the audit log are held in memory: they reset when the
  server restarts, and on a serverless host each instance keeps its own copy. Persisting
  them belongs in Supabase once it is configured.
- User management actions (activate/deactivate, change role) are not implemented yet,
  because there is no user table in this environment to act on.
