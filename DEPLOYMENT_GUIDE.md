# Wealth Growth Virtual Trading - Deployment Guide

## 🚀 Initial Setup & Deployment

### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key
4. Wait for the database to initialize

### Step 2: Set up Database

1. In Supabase, go to SQL Editor
2. Copy all SQL from `supabase_schema.sql` file
3. Paste and execute the SQL queries
4. This creates all required tables, policies, and indexes

### Step 3: Get API Keys

In Supabase Project Settings:
- **NEXT_PUBLIC_SUPABASE_URL**: Project URL
- **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Anon public key
- **SUPABASE_SERVICE_ROLE_KEY**: Service role secret key (keep this secret!)

### Step 4: Deploy on Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import the GitHub repository: `wealth-growth-virtual-trading`
4. Set Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY = your_service_role_key
   ```
5. Click Deploy

### Step 5: Verify Deployment

1. Go to your Vercel URL
2. Create a test account
3. Verify authentication works
4. Check that market data loads
5. Test placing a virtual order

## 📋 Testing Checklist

- [ ] User registration works
- [ ] User login works
- [ ] Dashboard loads with market data
- [ ] Market data refreshes automatically
- [ ] Can place a buy order
- [ ] Can place a sell order
- [ ] Portfolio updates correctly
- [ ] P&L calculations are correct
- [ ] Positions display correctly
- [ ] Orders history shows all orders

## 🔑 Admin Account Setup

After deployment:

1. Create a user account normally
2. In Supabase SQL Editor, run:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your_email@example.com';
   ```
3. Logout and login again
4. Admin menu should now appear

## 🌐 Live URL Structure

Your Vercel deployment provides:
- Main app: `https://your-project.vercel.app`
- Authentication: Automatic via Supabase
- API routes: `https://your-project.vercel.app/api/*`

## 📊 Initial Market Data

The platform includes simulated market data for:
- **NSE**: RELIANCE, TCS, INFY, WIPRO, HDFC, ICICIBANK, SBIN, MARUTI
- **Indices**: NIFTY50, NIFTYBANK, NIFTYIT
- **Commodities (MCX)**: GOLD, SILVER, CRUDEOIL, NATURALGAS
- **Forex**: USDINR, EURINR, GBPINR, JPYINR

Data refreshes every 30 seconds with realistic variations.

## 🔄 Automatic Deployments

After initial setup:
1. All changes push to main branch trigger automatic Vercel deployments
2. **NO manual deployment needed**
3. Simply: `git commit` → `git push origin main` → Vercel deploys automatically

## 📱 Testing Different Markets

After deployment, test each market section:

1. **Markets Page**
   - Switch between NSE, BSE, MCX, FOREX
   - Verify data loads and refreshes

2. **Stock Trading**
   - Search for a stock symbol
   - Place a market buy order
   - Verify position appears in portfolio
   - Place a sell order
   - Verify P&L is calculated

3. **Portfolio**
   - Check virtual balance (should be ₹1,000,000)
   - Verify open positions show correctly
   - Check P&L percentages

## 🐛 Common Issues & Solutions

### Issue: "Cannot connect to Supabase"
**Solution**: Check environment variables are correctly set in Vercel

### Issue: "Authentication fails"
**Solution**: Ensure Supabase Auth is enabled and RLS policies are configured

### Issue: "Market data not loading"
**Solution**: Check API routes are deployed and market data fetch works

### Issue: "Orders not executing"
**Solution**: Verify positions and orders tables have correct RLS policies

## 📞 Support & Troubleshooting

If you encounter issues:
1. Check Vercel deployment logs
2. Check Supabase SQL logs
3. Verify environment variables
4. Test with sample account
5. Review console errors in browser DevTools

## 🎯 Next Steps

After successful deployment:
1. Create test trading accounts
2. Practice trading with virtual balance
3. Monitor market data refresh
4. Test all trading features
5. Set up admin account
6. Configure any additional settings

---

**Deployment Status**: Ready for production! 🚀
