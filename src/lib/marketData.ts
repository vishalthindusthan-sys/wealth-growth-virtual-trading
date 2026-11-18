import { supabase } from './supabase';
import { TABLES } from './tables';
import { fetchQuotes } from './providers/yahoo';
import { ALL_INSTRUMENTS } from './marketUniverse';

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number | null;
  dayLow: number | null;
  previousClose: number | null;
  currency: string;
  exchange: string;
  quoteTime: string | null;
}

/**
 * Real (delayed) market data for the tracked universe.
 *
 * Server-side only: the provider endpoint sends no CORS headers, and this must
 * never fabricate prices. Instruments the provider cannot serve are left out,
 * and the caller reports partial data.
 */
export async function fetchMarketData(): Promise<StockData[]> {
  const { quotes } = await fetchQuotes(ALL_INSTRUMENTS.map((i) => i.providerSymbol));

  return ALL_INSTRUMENTS.flatMap((instrument) => {
    const quote = quotes.get(instrument.providerSymbol);
    if (!quote) return [];

    return [
      {
        symbol: instrument.symbol,
        name: instrument.label,
        price: quote.price,
        change: quote.change ?? 0,
        changePercent: quote.changePercent ?? 0,
        volume: quote.volume ?? 0,
        dayHigh: quote.dayHigh,
        dayLow: quote.dayLow,
        previousClose: quote.previousClose,
        currency: quote.currency,
        exchange: instrument.exchange,
        quoteTime: quote.quoteTime ? new Date(quote.quoteTime).toISOString() : null,
      },
    ];
  });
}

export async function updateInstrumentsInDB() {
  try {
    const data = await fetchMarketData();

    if (data.length === 0) {
      console.error('No market data returned by the provider; skipping DB update');
      return false;
    }

    const { error } = await supabase.from(TABLES.instruments).upsert(
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
    const { data, error } = await supabase.from(TABLES.instruments).select('*').eq('symbol', symbol).single();

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
    const { data, error } = await supabase.from(TABLES.instruments).select('*');

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
      .from(TABLES.instruments)
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
