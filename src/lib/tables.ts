/**
 * Table names for this app.
 *
 * Every table is prefixed `wgvt_` because the Supabase project is shared with
 * the quickbite food-ordering demo (which owns `public.orders`) and with the
 * `wg_` tables of the Wealth Growth recommendation site. Always go through
 * these constants rather than writing the names inline.
 */
export const TABLES = {
  users: 'wgvt_users',
  instruments: 'wgvt_instruments',
  orders: 'wgvt_orders',
  positions: 'wgvt_positions',
  watchlists: 'wgvt_watchlists',
  recommendations: 'wgvt_recommendations',
  transactions: 'wgvt_transactions',
} as const;
