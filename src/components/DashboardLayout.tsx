'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, LogOut, User } from 'lucide-react';

interface User {
  email: string;
  full_name: string;
  role: string;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  async function fetchUser() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();

      if (userData) {
        setUser(userData);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/');
  }

  const menuItems = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Live Market', href: '/live', icon: '🟢' },
    { name: 'Markets', href: '/markets', icon: '📈' },
    { name: 'Stocks', href: '/stocks', icon: '📉' },
    { name: 'Portfolio', href: '/portfolio', icon: '💼' },
    { name: 'Orders', href: '/orders', icon: '📋' },
    { name: 'Positions', href: '/positions', icon: '🎯' },
    { name: 'Watchlist', href: '/watchlist', icon: '⭐' },
    { name: 'Recommendations', href: '/recommendations', icon: '💡' },
    { name: 'Reports', href: '/reports', icon: '📄' },
    ...(user?.role === 'admin' ? [{ name: 'Admin', href: '/admin', icon: '🔧' }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white p-2 hover:bg-gray-800 rounded">
              <Menu className="w-6 h-6" />
            </button>
            <Link href="/dashboard" className="text-xl font-bold text-white">
              💰 Wealth Growth
            </Link>
          </div>

          <div className="relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white">
              <User className="w-4 h-4" />
              <span className="text-sm">{user?.email}</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg">
                <Link href="/profile" className="block px-4 py-2 text-white hover:bg-gray-700">
                  Profile
                </Link>
                <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-red-400 hover:bg-gray-700">
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        {sidebarOpen && (
          <aside className="w-64 bg-gray-900 border-r border-gray-800 h-screen overflow-y-auto sticky top-16">
            <nav className="p-4 space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-4 py-3 text-gray-300 hover:bg-gray-800 hover:text-white rounded-lg transition"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
