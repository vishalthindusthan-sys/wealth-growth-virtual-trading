# Wealth Growth Virtual Trading Platform

A professional virtual trading platform for Indian markets built with Next.js, Supabase, and TradingView Charts.

## 🚀 Features

- **Virtual Trading**: Practice trading with unlimited virtual balance
- **Multi-Market Support**: NSE, BSE, MCX, and FOREX markets
- **Real-time Market Data**: 30-second market data refresh
- **Advanced Orders**: Market, Limit, and Stop-Loss orders
- **Portfolio Management**: Track positions, P&L, and holdings
- **Professional Charts**: Interactive candlestick and line charts
- **Watchlists**: Create and manage multiple watchlists
- **Admin Dashboard**: User management and market data controls
- **Excel Export**: Download reports and data in Excel format
- **User Authentication**: Secure login and registration with Supabase Auth

## 📋 Tech Stack

- **Frontend**: React 18, Next.js 14, TypeScript
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Charts**: Lightweight Charts
- **Icons**: Lucide React
- **Export**: ExcelJS
- **Authentication**: Supabase Auth

## 🔧 Installation

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Vercel account (for deployment)

### Local Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/wealth-growth-virtual-trading.git
cd wealth-growth-virtual-trading
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
Create a `.env.local` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. **Set up Supabase**
- Go to your Supabase project
- Run the SQL queries from `supabase_schema.sql` in the SQL editor
- This creates all necessary tables, policies, and indexes

5. **Run the development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
src/
  ├── app/
  │   ├── auth/              # Login and signup pages
  │   ├── dashboard/         # Main dashboard
  │   ├── markets/           # Market data view
  │   ├── portfolio/         # Portfolio and holdings
  │   └── api/               # API routes
  ├── components/            # React components
  ├── lib/                   # Utilities and configurations
  └── types/                 # TypeScript type definitions
```

## 🗄️ Database Schema

### Key Tables
- **users**: User profiles and balances
- **instruments**: Stock and market data
- **orders**: Trading orders
- **positions**: Open positions
- **watchlists**: User watchlists
- **transactions**: Transaction audit log

## 🔐 Security Features

- **Row Level Security (RLS)**: Users can only access their own data
- **Service Role Key**: Sensitive operations use server-side authentication
- **No Client-Side Secrets**: API keys are stored server-side only
- **Atomic Transactions**: Order execution is atomic to prevent inconsistencies

## 🌐 Deployment on Vercel

### Setup
1. Push code to GitHub repository
2. Connect repository to Vercel
3. Add environment variables
4. Deploy

### After Deployment
- Vercel automatically deploys on `git push` to main branch
- For future updates, simply commit and push changes
- **DO NOT manually trigger deployments**

## 📊 Markets Supported

### Equity
- NSE (National Stock Exchange)
- BSE (Bombay Stock Exchange)

### Derivatives
- Futures and Options
- Index Options

### Commodities
- Gold, Silver, Crude Oil, Natural Gas

### Currency
- USD/INR, EUR/INR, GBP/INR, JPY/INR

## 📝 Future Updates Workflow

For any future modifications:

1. Make changes to the codebase
2. Test locally with `npm run dev`
3. Commit changes: `git commit -m "message"`
4. Push to main: `git push origin main`
5. Vercel auto-deploys - No manual deployment needed

---

**Happy Trading!** 🚀📈💰
