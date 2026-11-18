import Link from 'next/link';

/**
 * Landing page. There is no sign-in, so this is a plain server component -
 * the old session check that bounced visitors to /dashboard went with the
 * auth pages.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-blue-950 to-gray-950">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="mb-20 text-center">
          <h1 className="mb-4 text-6xl font-bold text-white">Wealth Growth Virtual Trading</h1>
          <p className="mb-8 text-2xl text-gray-300">Live Indian market data, no account needed</p>
          <div className="space-x-4">
            <Link
              href="/live"
              className="inline-block rounded-lg bg-blue-600 px-8 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Open Live Dashboard
            </Link>
            <Link
              href="/markets"
              className="inline-block rounded-lg bg-gray-800 px-8 py-3 font-semibold text-white transition hover:bg-gray-700"
            >
              Browse Markets
            </Link>
          </div>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
            <h3 className="mb-4 text-xl font-semibold text-white">🔎 Search any instrument</h3>
            <p className="text-gray-400">
              Find a stock by company name or symbol, plus indices, commodities and INR currency pairs, with the live
              price in the suggestion list.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
            <h3 className="mb-4 text-xl font-semibold text-white">📊 Live market data</h3>
            <p className="text-gray-400">
              Delayed NSE, BSE, commodity and currency prices from a free feed, refreshed every 30 seconds with the
              age of each quote shown.
            </p>
          </div>
          <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-8 backdrop-blur">
            <h3 className="mb-4 text-xl font-semibold text-white">📥 Export a snapshot</h3>
            <p className="text-gray-400">
              Download the whole market snapshot as CSV, with prices, day range, previous close, volume and timestamps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
