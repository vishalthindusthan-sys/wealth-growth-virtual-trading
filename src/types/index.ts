export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP_LOSS = 'stop_loss',
  STOP_LOSS_MARKET = 'stop_loss_market',
}

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderStatus {
  PENDING = 'pending',
  EXECUTED = 'executed',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
  PARTIALLY_FILLED = 'partially_filled',
}

export enum InstrumentType {
  EQUITY = 'equity',
  FUTURES = 'futures',
  OPTIONS = 'options',
  COMMODITY = 'commodity',
  CURRENCY = 'currency',
}

export enum Exchange {
  NSE = 'NSE',
  BSE = 'BSE',
  MCX = 'MCX',
  NCDEX = 'NCDEX',
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  virtual_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Instrument {
  id: string;
  symbol: string;
  name: string;
  exchange: Exchange;
  type: InstrumentType;
  lot_size: number;
  tick_size: number;
  current_price: number;
  open_price: number;
  high_price: number;
  low_price: number;
  close_price: number;
  volume: number;
  last_updated: string;
}

export interface Order {
  id: string;
  user_id: string;
  instrument_id: string;
  order_type: OrderType;
  side: OrderSide;
  quantity: number;
  price: number;
  trigger_price?: number;
  status: OrderStatus;
  executed_price?: number;
  executed_quantity?: number;
  brokerage: number;
  created_at: string;
  executed_at?: string;
}

export interface Position {
  id: string;
  user_id: string;
  instrument_id: string;
  quantity: number;
  average_price: number;
  current_price: number;
  pnl: number;
  pnl_percentage: number;
  created_at: string;
  updated_at: string;
}

export interface Watchlist {
  id: string;
  user_id: string;
  name: string;
  instruments: string[]; // instrument_ids
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  instrument_id: string;
  strategy: string;
  entry_price: number;
  target_price: number;
  stop_loss: number;
  risk_reward_ratio: number;
  timeframe: string;
  reason: string;
  status: 'active' | 'closed' | 'archived';
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_trades: number;
  total_orders: number;
  market_data_status: string;
  api_status: string;
}
