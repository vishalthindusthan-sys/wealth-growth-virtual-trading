'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Lock, ShieldCheck } from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json?.error || 'Sign-in failed');
        return;
      }

      router.push(next.startsWith('/admin') ? next : '/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-xl border border-gray-800 bg-gray-900 p-6">
      <div className="flex items-center gap-2 text-white">
        <ShieldCheck className="h-5 w-5 text-blue-400" />
        <h1 className="text-lg font-semibold">Admin sign-in</h1>
      </div>
      <p className="text-xs text-gray-500">
        Separate from user accounts. Credentials come from the server environment, not the user database.
      </p>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-400">Admin email</span>
        <input
          type="email"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          placeholder="admin@example.com"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-gray-400">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          placeholder="••••••••"
        />
      </label>

      {error && (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-300">{error}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-60"
      >
        <Lock className="h-4 w-4" />
        {busy ? 'Signing in…' : 'Sign in'}
      </button>

      <p className="text-center text-xs text-gray-600">
        <Link href="/live" className="hover:text-gray-400">
          Back to the live market dashboard
        </Link>
      </p>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
      <Suspense fallback={<div className="text-sm text-gray-500">Loading…</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
