import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ADMIN_COOKIE, isAdminConfigured, readSession } from '@/lib/adminAuth';
import AdminDashboard from './AdminDashboard';

export const metadata = {
  title: 'Admin panel | Wealth Growth Virtual Trading',
};

// The page reads the session cookie before rendering anything, so it must be
// rendered per request rather than prerendered (cacheComponents is enabled).
export const instant = false;

export default async function AdminPage() {
  if (!isAdminConfigured()) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
        <div className="max-w-lg space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 text-sm text-amber-200">
          <h1 className="text-base font-semibold text-amber-100">Admin panel is not configured</h1>
          <p>
            Set ADMIN_USER_ID, ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET in the server environment, then
            restart. SETUP.md documents each value.
          </p>
          <p className="text-xs text-amber-200/70">
            Until then the admin routes stay closed rather than falling back to an open page.
          </p>
          <Link href="/live" className="inline-block text-xs text-blue-300 hover:underline">
            Back to the live market dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Second check after the middleware, so the page is never rendered on a
  // forged or expired cookie even if the matcher changes.
  const session = await readSession((await cookies()).get(ADMIN_COOKIE)?.value);
  if (!session) {
    redirect('/admin/login');
  }

  return <AdminDashboard />;
}
