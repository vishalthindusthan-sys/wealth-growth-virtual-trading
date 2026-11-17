import axios from 'axios';
import { supabase } from './supabase';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  exchange: string;
}

const MOCK_INSTRUMENTS = {
  NSE: [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE' },
    { symbol: 'INFY', name: 'Infosys', exchange: 'NSE' },
    { symbol: 'WIPRO', name: 'Wipro', exchange: 'NSE' },
    { symbol: 'HDFC', name: 'HDFC Bank', exchange: 'NSE' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki', exchange: 'NSE' },
  ],
  BSE: [
    { symbol: 'SENSEX', name: 'BSE Sensex Index', exchange: 'BSE' },
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'BSE' },
    { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'BSE' },
  ],
  NIFTY: [
    { symbol: 'NIFTY50', name: 'NIFTY 50 Index', exchange: 'NSE' },
    { symbol: 'NIFTYBANK', name: 'NIFTY Bank Index', exchange: 'NSE' },
    { symbol: 'NIFTYIT', name: 'NIFTY IT Index', exchange: 'NSE' },
  ],
  MCX: [
    { symbol: 'GOLD', name: 'Gold', exchange: 'MCX' },
    { symbol: 'SILVER', name: 'Silver', exchange: 'MCX' },
    { symbol: 'CRUDEOIL', name: 'Crude Oil', exchange: 'MCX' },
    { symbol: 'NATURALGAS', name: 'Natural Gas', exchange: 'MCX' },
  ],
  FOREX: [
    { symbol: 'USDINR', name: 'USD/INR', exchange: 'FOREX' },
    { symbol: 'EURINR', name: 'EUR/INR', exchange: 'FOREX' },
    { symbol: 'GBPINR', name: 'GBP/INR', exchange: 'FOREX' },
    { symbol: 'JPYINR', name: 'JPY/INR', exchange: 'FOREX' },
  ],
};

function generateMockPrice(symbol: string, basePrice: number): number {
  const hash = symbol.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const variation = ((hash % 100) - 50) / 100;
  return basePrice * (1 + variation * 0.05);
}

export async function fetchMarketData() {
  try {
    const instruments: StockData[] = [];

    // Generate mock data for demonstration
    const baseNSEPrices: { [key: string]: number } = {
      RELIANCE: 2850,
      TCS: 3950,
      INFY: 2200,
      WIPRO: 450,
      HDFC: 2500,
      ICICIBANK: 820,
      SBIN: 580,
      MARUTI: 7500,
      NIFTY50: 24500,
      NIFTYBANK: 56000,
      NIFTYIT: 42000,
    };

    const baseMCXPrices: { [key: string]: number } = {
      GOLD: 65000,
      SILVER: 85000,
      CRUDEOIL: 85,
      NATURALGAS: 450,
    };

    const baseForexPrices: { [key: string]: number } = {
      USDINR: 83.5,
      EURINR: 92.0,
      GBPINR: 105.0,
      JPYINR: 0.55,
    };

    // NSE Data
    for (const [symbol, basePrice] of Object.entries(baseNSEPrices)) {
      const price = generateMockPrice(symbol, basePrice);
      const change = (Math.random() - 0.5) * 100;
      instruments.push({
        symbol,
        name: MOCK_INSTRUMENTS.NSE.find((i) => i.symbol === symbol)?.name || symbol,
        price,
        change,
        changePercent: (change / price) * 100,
        volume: Math.floor(Math.random() * 10000000),
        exchange: 'NSE',
      });
    }

    // MCX Data
    for (const [symbol, basePrice] of Object.entries(baseMCXPrices)) {
      const price = generateMockPrice(symbol, basePrice);
      const change = (Math.random() - 0.5) * 1000;
      instruments.push({
        symbol,
        name: MOCK_INSTRUMENTS.MCX.find((i) => i.symbol === symbol)?.name || symbol,
        price,
        change,
        changePercent: (change / price) * 100,
        volume: Math.floor(Math.random() * 100000),
        exchange: 'MCX',
      });
    }

    // Forex Data
    for (const [symbol, basePrice] of Object.entries(baseForexPrices)) {
      const price = generateMockPrice(symbol, basePrice);
      const change = (Math.random() - 0.5) * 2;
      instruments.push({
        symbol,
        name: MOCK_INSTRUMENTS.FOREX.find((i) => i.symbol === symbol)?.name || symbol,
        price,
        change,
        changePercent: (change / price) * 100,
        volume: Math.floor(Math.random() * 1000000),
        exchange: 'FOREX',
      });
    }

    return instruments;
  } catch (error) {
    console.error('Error fetching market data:', error);
    return [];
  }
}

export async function updateInstrumentsInDB() {
  try {
    const data = await fetchMarketData();

    // Batch update instruments in Supabase
    const { error } = await supabase.from('instruments').upsert(
      data.map((d) => ({
        symbol: d.symbol,
        name: d.name,
        exchange: d.exchange,
        current_price: d.price,
        change_percent: d.changePercent,
        volume: d.volume,
        last_updated: new Date().toISOString(),
      }))
    );

    if (error) {
      console.error('Error updating instruments:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in updateInstrumentsInDB:', error);
    return false;
  }
}

export async function getInstrumentBySymbol(symbol: string) {
  try {
    const { data, error } = await supabase.from('instruments').select('*').eq('symbol', symbol).single();

    if (error) {
      console.error('Error fetching instrument:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
}

export async function getAllInstruments() {
  try {
    const { data, error } = await supabase.from('instruments').select('*');

    if (error) {
      console.error('Error fetching instruments:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}

export async function searchInstruments(query: string) {
  try {
    const { data, error } = await supabase
      .from('instruments')
      .select('*')
      .or(`symbol.ilike.%${query}%, name.ilike.%${query}%`)
      .limit(20);

    if (error) {
      console.error('Error searching instruments:', error);
      return [];
    }

    return data;
  } catch (error) {
    console.error('Error:', error);
    return [];
  }
}
