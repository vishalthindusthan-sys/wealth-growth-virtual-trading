'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu } from 'lucide-react';

/**
 * Shell for the public pages. The platform has no sign-in: the user chrome,
 * the role-based menu and the logout button went with the auth pages, so this
 * lists only routes that exist.
 */
const MENU_ITEMS = [
  { name: 'Live Market', href: '/live', icon: '🟢' },
  { name: 'Markets', href: '/markets', icon: '📈' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-900">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation"
              className="rounded p-2 text-white hover:bg-gray-800"
            >
              <Menu className="h-6 w-6" />
            </button>
            <Link href="/" className="text-xl font-bold text-white">
              💰 Wealth Growth
            </Link>
          </div>

          <span className="rounded bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-300">
            Virtual trading · delayed data
          </span>
        </div>
      </header>

      <div className="flex">
        {sidebarOpen && (
          <aside className="sticky top-16 h-screen w-64 overflow-y-auto border-r border-gray-800 bg-gray-900">
            <nav className="space-y-2 p-4">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-lg px-4 py-3 text-gray-300 transition hover:bg-gray-800 hover:text-white"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
