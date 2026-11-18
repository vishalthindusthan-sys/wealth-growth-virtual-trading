'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // Redirect to dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error checking session:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      <div className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center mb-20">
          <h1 className="text-6xl font-bold text-white mb-4">Wealth Growth Virtual Trading</h1>
          <p className="text-2xl text-gray-300 mb-8">Professional Virtual Trading Platform for Indian Markets</p>
          <div className="space-x-4">
            <Link
              href="/live"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
            >
              Open Live Dashboard
            </Link>
            <Link
              href="/markets"
              className="inline-block px-8 py-3 bg-gray-800 text-white rounded-lg font-semibold hover:bg-gray-700 transition"
            >
              Browse Markets
            </Link>

          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-20">
          <div className="bg-gray-800/50 backdrop-blur p-8 rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">🚀 Unlimited Virtual Balance</h3>
            <p className="text-gray-400">Trade with unlimited virtual capital. No real money required.</p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur p-8 rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">📊 Live Market Data</h3>
            <p className="text-gray-400">
              Delayed NSE, BSE, commodity and currency prices from a free feed, refreshed every 30 seconds with the
              data age shown.
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur p-8 rounded-lg border border-gray-700">
            <h3 className="text-xl font-semibold text-white mb-4">💹 Advanced Trading</h3>
            <p className="text-gray-400">Market, limit, and stop-loss orders with professional charts.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
