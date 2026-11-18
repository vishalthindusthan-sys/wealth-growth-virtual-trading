/**
 * The instruments the live dashboard tracks, mapped to provider symbols.
 * Every symbol here was verified against the provider on 18 Nov 2026.
 */

export type Segment = 'INDEX' | 'EQUITY' | 'COMMODITY' | 'CURRENCY';

export interface Instrument {
  /** Symbol shown in the UI (NSE trading symbol where applicable). */
  symbol: string;
  label: string;
  segment: Segment;
  exchange: string;
  providerSymbol: string;
  /** Shown as a caveat in the UI, e.g. global benchmark instead of MCX. */
  note?: string;
}

export const INDICES: Instrument[] = [
  { symbol: 'NIFTY 50', label: 'NIFTY 50', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^NSEI' },
  { symbol: 'BANK NIFTY', label: 'NIFTY BANK', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^NSEBANK' },
  { symbol: 'SENSEX', label: 'S&P BSE SENSEX', segment: 'INDEX', exchange: 'BSE', providerSymbol: '^BSESN' },
  { symbol: 'NIFTY IT', label: 'NIFTY IT', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^CNXIT' },
  { symbol: 'NIFTY NEXT 50', label: 'NIFTY NEXT 50', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^NSMIDCP' },
  { symbol: 'NIFTY AUTO', label: 'NIFTY AUTO', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^CNXAUTO' },
  { symbol: 'NIFTY PHARMA', label: 'NIFTY PHARMA', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^CNXPHARMA' },
  { symbol: 'NIFTY FMCG', label: 'NIFTY FMCG', segment: 'INDEX', exchange: 'NSE', providerSymbol: '^CNXFMCG' },
];

const NSE_EQUITIES: [string, string][] = [
  ['RELIANCE', 'Reliance Industries'],
  ['TCS', 'Tata Consultancy Services'],
  ['HDFCBANK', 'HDFC Bank'],
  ['ICICIBANK', 'ICICI Bank'],
  ['INFY', 'Infosys'],
  ['BHARTIARTL', 'Bharti Airtel'],
  ['SBIN', 'State Bank of India'],
  ['LT', 'Larsen & Toubro'],
  ['ITC', 'ITC'],
  ['HINDUNILVR', 'Hindustan Unilever'],
  ['KOTAKBANK', 'Kotak Mahindra Bank'],
  ['AXISBANK', 'Axis Bank'],
  ['BAJFINANCE', 'Bajaj Finance'],
  ['BAJAJFINSV', 'Bajaj Finserv'],
  ['MARUTI', 'Maruti Suzuki'],
  ['M&M', 'Mahindra & Mahindra'],
  ['SUNPHARMA', 'Sun Pharmaceutical'],
  ['CIPLA', 'Cipla'],
  ['DRREDDY', 'Dr. Reddy Laboratories'],
  ['TITAN', 'Titan Company'],
  ['ASIANPAINT', 'Asian Paints'],
  ['TRENT', 'Trent'],
  ['WIPRO', 'Wipro'],
  ['HCLTECH', 'HCL Technologies'],
  ['TECHM', 'Tech Mahindra'],
  ['ADANIENT', 'Adani Enterprises'],
  ['TATASTEEL', 'Tata Steel'],
  ['JSWSTEEL', 'JSW Steel'],
  ['ULTRACEMCO', 'UltraTech Cement'],
  ['GRASIM', 'Grasim Industries'],
  ['NTPC', 'NTPC'],
  ['POWERGRID', 'Power Grid Corporation'],
  ['ONGC', 'Oil & Natural Gas Corporation'],
  ['COALINDIA', 'Coal India'],
  ['NESTLEIND', 'Nestle India'],
  ['EICHERMOT', 'Eicher Motors'],
  ['HEROMOTOCO', 'Hero MotoCorp'],
  ['ETERNAL', 'Eternal (Zomato)'],
  ['TMPV', 'Tata Motors Passenger Vehicles'],
  ['TMCV', 'Tata Motors (Commercial Vehicles)'],
];

export const EQUITIES: Instrument[] = NSE_EQUITIES.map(([symbol, label]) => ({
  symbol,
  label,
  segment: 'EQUITY' as const,
  exchange: 'NSE',
  providerSymbol: `${symbol}.NS`,
}));

const GLOBAL_BENCHMARK_NOTE =
  'Global benchmark future - MCX contract prices are not available on a free feed';

export const COMMODITIES: Instrument[] = [
  { symbol: 'GOLD', label: 'Gold', segment: 'COMMODITY', exchange: 'COMEX', providerSymbol: 'GC=F', note: GLOBAL_BENCHMARK_NOTE },
  { symbol: 'SILVER', label: 'Silver', segment: 'COMMODITY', exchange: 'COMEX', providerSymbol: 'SI=F', note: GLOBAL_BENCHMARK_NOTE },
  { symbol: 'CRUDEOIL', label: 'Crude Oil (WTI)', segment: 'COMMODITY', exchange: 'NYMEX', providerSymbol: 'CL=F', note: GLOBAL_BENCHMARK_NOTE },
  { symbol: 'NATURALGAS', label: 'Natural Gas', segment: 'COMMODITY', exchange: 'NYMEX', providerSymbol: 'NG=F', note: GLOBAL_BENCHMARK_NOTE },
  { symbol: 'COPPER', label: 'Copper', segment: 'COMMODITY', exchange: 'COMEX', providerSymbol: 'HG=F', note: GLOBAL_BENCHMARK_NOTE },
  { symbol: 'ALUMINIUM', label: 'Aluminium', segment: 'COMMODITY', exchange: 'COMEX', providerSymbol: 'ALI=F', note: GLOBAL_BENCHMARK_NOTE },
];

export const CURRENCIES: Instrument[] = [
  { symbol: 'USDINR', label: 'USD / INR', segment: 'CURRENCY', exchange: 'FX', providerSymbol: 'USDINR=X' },
  { symbol: 'EURINR', label: 'EUR / INR', segment: 'CURRENCY', exchange: 'FX', providerSymbol: 'EURINR=X' },
  { symbol: 'GBPINR', label: 'GBP / INR', segment: 'CURRENCY', exchange: 'FX', providerSymbol: 'GBPINR=X' },
  { symbol: 'JPYINR', label: 'JPY / INR', segment: 'CURRENCY', exchange: 'FX', providerSymbol: 'JPYINR=X' },
];

export const ALL_INSTRUMENTS: Instrument[] = [
  ...INDICES,
  ...EQUITIES,
  ...COMMODITIES,
  ...CURRENCIES,
];

/* ------------------------------------------------------------------ *
 * NSE / BSE session clock (IST), computed without any date library.
 * Exchange holidays are not included - the UI says so.
 * ------------------------------------------------------------------ */

export interface MarketStatus {
  state: 'PRE_OPEN' | 'OPEN' | 'CLOSED' | 'WEEKEND';
  label: string;
  istTime: string;
  istDate: string;
  nextChange: string | null;
  caveat: string;
}

export function getMarketStatus(at: Date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(at);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = get('weekday');
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const minutes = hour * 60 + minute;

  const istTime = `${get('hour')}:${get('minute')}:${get('second')}`;
  const istDate = `${weekday}, ${get('day')} ${get('month')} ${get('year')}`;
  const caveat = 'Session times only - NSE/BSE trading holidays are not applied.';

  if (weekday === 'Sat' || weekday === 'Sun') {
    return { state: 'WEEKEND', label: 'Closed (weekend)', istTime, istDate, nextChange: 'Monday 09:15 IST', caveat };
  }

  const PRE_OPEN = 9 * 60; // 09:00
  const OPEN = 9 * 60 + 15; // 09:15
  const CLOSE = 15 * 60 + 30; // 15:30

  if (minutes >= PRE_OPEN && minutes < OPEN) {
    return { state: 'PRE_OPEN', label: 'Pre-open', istTime, istDate, nextChange: 'Opens 09:15 IST', caveat };
  }
  if (minutes >= OPEN && minutes < CLOSE) {
    return { state: 'OPEN', label: 'Open', istTime, istDate, nextChange: 'Closes 15:30 IST', caveat };
  }
  if (minutes < PRE_OPEN) {
    return { state: 'CLOSED', label: 'Closed', istTime, istDate, nextChange: 'Pre-open 09:00 IST', caveat };
  }
  return { state: 'CLOSED', label: 'Closed', istTime, istDate, nextChange: 'Pre-open 09:00 IST tomorrow', caveat };
}
