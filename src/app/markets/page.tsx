'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import DashboardLayout from '@/components/DashboardLayout';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { TABLES } from '@/lib/tables';

interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  current_price: number;
  change_percent: number;
  volume: number;
}

export default function Markets() {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [exchange, setExchange] = useState('NSE');

  useEffect(() => {
    fetchInstruments();
    const interval = setInterval(fetchInstruments, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [exchange]);

  async function fetchInstruments() {
    try {
      const { data } = await supabase.from(TABLES.instruments).select('*').eq('exchange', exchange).limit(50);

      if (data) {
        setInstruments(data);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Markets</h1>
          <div className="flex gap-2">
            {['NSE', 'BSE', 'MCX', 'FOREX'].map((ex) => (
              <button
                key={ex}
                onClick={() => setExchange(ex)}
                className={`px-4 py-2 rounded-lg font-semibold transition ${exchange === ex ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-400">Loading instruments...</div>
        ) : (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-900 border-b border-gray-700">
                    <th className="text-left text-gray-300 py-4 px-4">Symbol</th>
                    <th className="text-left text-gray-300 py-4 px-4">Name</th>
                    <th className="text-right text-gray-300 py-4 px-4">Price</th>
                    <th className="text-right text-gray-300 py-4 px-4">Change %</th>
                    <th className="text-right text-gray-300 py-4 px-4">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {instruments.map((inst) => (
                    <tr key={inst.id} className="border-b border-gray-700 hover:bg-gray-700/50 transition">
                      <td className="py-4 px-4 text-white font-semibold">{inst.symbol}</td>
                      <td className="py-4 px-4 text-gray-300">{inst.name}</td>
                      <td className="py-4 px-4 text-right text-white">₹{inst.current_price?.toFixed(2)}</td>
                      <td className={`py-4 px-4 text-right font-semibold flex items-center justify-end gap-1 ${inst.change_percent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {inst.change_percent >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {Math.abs(inst.change_percent).toFixed(2)}%
                      </td>
                      <td className="py-4 px-4 text-right text-gray-400">{(inst.volume / 1000000).toFixed(2)}M</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
