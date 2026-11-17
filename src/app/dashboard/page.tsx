'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, TrendingDown, BarChart3, Wallet } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name: string;
  virtual_balance: number;
  role: string;
}

interface Order {
  id: string;
  instrument_id: string;
  side: string;
  quantity: number;
  executed_price: number;
  created_at: string;
  status: string;
}

interface Position {
  id: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  instruments: {
    symbol: string;
    name: string;
  };
}

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPnL, setTotalPnL] = useState(0);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/auth/login');
        return;
      }

      // Fetch user data
      const { data: userData } = await supabase.from('users').select('*').eq('id', session.user.id).single();

      if (userData) {
        setUser(userData);
      }

      // Fetch orders
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (ordersData) {
        setOrders(ordersData);
      }

      // Fetch positions
      const { data: positionsData } = await supabase
        .from('positions')
        .select('*, instruments(symbol, name)')
        .eq('user_id', session.user.id);

      if (positionsData) {
        setPositions(positionsData);
        const totalPnL = positionsData.reduce((sum: number, pos: any) => sum + (pos.pnl || 0), 0);
        setTotalPnL(totalPnL);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-white text-xl">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Virtual Balance</p>
                <p className="text-2xl font-bold text-white mt-2">₹{(user?.virtual_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              <Wallet className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total P&L</p>
                <p className={`text-2xl font-bold mt-2 ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
              </div>
              {totalPnL >= 0 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-red-500" />
              )}
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Open Positions</p>
                <p className="text-2xl font-bold text-white mt-2">{positions.length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Orders</p>
                <p className="text-2xl font-bold text-white mt-2">{orders.length}</p>
              </div>
              <BarChart3 className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 py-3 px-4">Time</th>
                  <th className="text-left text-gray-400 py-3 px-4">Type</th>
                  <th className="text-left text-gray-400 py-3 px-4">Qty</th>
                  <th className="text-left text-gray-400 py-3 px-4">Price</th>
                  <th className="text-left text-gray-400 py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-700">
                    <td className="py-3 px-4 text-white">{new Date(order.created_at).toLocaleDateString()}</td>
                    <td className={`py-3 px-4 font-semibold ${order.side === 'buy' ? 'text-green-500' : 'text-red-500'}`}>{order.side.toUpperCase()}</td>
                    <td className="py-3 px-4 text-white">{order.quantity}</td>
                    <td className="py-3 px-4 text-white">₹{order.executed_price}</td>
                    <td className="py-3 px-4">
                      <span className="bg-blue-500/20 text-blue-200 px-3 py-1 rounded text-sm">{order.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Open Positions */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Open Positions</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left text-gray-400 py-3 px-4">Symbol</th>
                  <th className="text-left text-gray-400 py-3 px-4">Qty</th>
                  <th className="text-left text-gray-400 py-3 px-4">Avg Price</th>
                  <th className="text-left text-gray-400 py-3 px-4">Current</th>
                  <th className="text-left text-gray-400 py-3 px-4">P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((pos) => (
                  <tr key={pos.id} className="border-b border-gray-700">
                    <td className="py-3 px-4 text-white font-semibold">{pos.instruments.symbol}</td>
                    <td className="py-3 px-4 text-white">{pos.quantity}</td>
                    <td className="py-3 px-4 text-white">₹{pos.average_price}</td>
                    <td className="py-3 px-4 text-white">₹{pos.current_price}</td>
                    <td className={`py-3 px-4 font-semibold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{pos.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({pos.pnl_percentage.toFixed(2)}%)</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
