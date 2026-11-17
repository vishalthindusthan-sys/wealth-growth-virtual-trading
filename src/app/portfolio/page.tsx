'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, TrendingDown } from 'lucide-react';

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

interface User {
  virtual_balance: number;
}

export default function Portfolio() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      // Fetch user balance
      const { data: userData } = await supabase.from('users').select('virtual_balance').eq('id', session.user.id).single();

      setUser(userData);

      // Fetch positions
      const { data: positionsData } = await supabase.from('positions').select('*, instruments(symbol, name)').eq('user_id', session.user.id);

      if (positionsData) {
        setPositions(positionsData);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  const totalInvested = positions.reduce((sum, pos) => sum + pos.average_price * pos.quantity, 0);
  const totalCurrentValue = positions.reduce((sum, pos) => sum + pos.current_price * pos.quantity, 0);
  const totalPnL = totalCurrentValue - totalInvested;
  const totalPnLPercent = (totalPnL / (totalInvested || 1)) * 100;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Portfolio</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Virtual Balance</p>
            <p className="text-2xl font-bold text-white mt-1">₹{(user?.virtual_balance || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total Invested</p>
            <p className="text-2xl font-bold text-white mt-1">₹{totalInvested.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Current Value</p>
            <p className="text-2xl font-bold text-white mt-1">₹{totalCurrentValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm">Total P&L</p>
            <p className={`text-2xl font-bold mt-1 ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{totalPnL.toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({totalPnLPercent.toFixed(2)}%)</p>
          </div>
        </div>

        {/* Holdings Table */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">Holdings</h2>
          </div>

          {loading ? (
            <div className="p-4 text-center text-gray-400">Loading...</div>
          ) : positions.length === 0 ? (
            <div className="p-4 text-center text-gray-400">No positions yet. Start trading to see your holdings here.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-700">
                    <th className="text-left text-gray-300 py-4 px-4">Symbol</th>
                    <th className="text-right text-gray-300 py-4 px-4">Quantity</th>
                    <th className="text-right text-gray-300 py-4 px-4">Avg Price</th>
                    <th className="text-right text-gray-300 py-4 px-4">Current</th>
                    <th className="text-right text-gray-300 py-4 px-4">P&L</th>
                    <th className="text-right text-gray-300 py-4 px-4">P&L %</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                      <td className="py-4 px-4 text-white font-semibold">{pos.instruments.symbol}</td>
                      <td className="py-4 px-4 text-right text-gray-300">{pos.quantity}</td>
                      <td className="py-4 px-4 text-right text-gray-300">₹{pos.average_price.toFixed(2)}</td>
                      <td className="py-4 px-4 text-right text-white">₹{pos.current_price.toFixed(2)}</td>
                      <td className={`py-4 px-4 text-right font-semibold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>₹{pos.pnl.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                      <td className={`py-4 px-4 text-right font-semibold flex items-center justify-end gap-1 ${pos.pnl_percentage >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {pos.pnl_percentage >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {pos.pnl_percentage.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
