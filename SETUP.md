# Quick Setup Guide - Wealth Growth Virtual Trading

## ⚡ 5-Minute Setup

### Step 1: Create Supabase Account & Project (2 min)
1. Go to https://supabase.com and sign up
2. Create a new project (choose your closest region)
3. Wait for database initialization
4. Go to Project Settings → API and copy:
   - Project URL
   - Anon public key
   - Service role secret

### Step 2: Run Database Schema (1 min)
1. In Supabase, open SQL Editor
2. Create new query
3. Copy entire contents of `supabase_schema.sql`
4. Paste and Execute
5. All tables will be created automatically

### Step 3: Deploy to Vercel (2 min)
1. Go to https://vercel.com and sign in with GitHub
2. Click "Add New" → "Project"
3. Select `wealth-growth-virtual-trading` repository
4. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
   SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
   ```
5. Click Deploy

### Step 4: Access Your Platform
- Once deployed, Vercel shows your live URL
- Create an account to test
- Start trading with ₹1,000,000 virtual balance!

## 🔑 Admin Account (Optional)

After creating your first user account:
1. Go to Supabase SQL Editor
2. Run this query:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your_email@gmail.com';
```
3. Logout and login again - Admin menu appears!

## ✅ Verification Checklist

After deployment, verify these work:
- [ ] Sign up and login
- [ ] Dashboard shows ₹1,000,000 balance
- [ ] Markets page loads with real data
- [ ] Can place a buy order
- [ ] Position appears in portfolio
- [ ] P&L calculates correctly
- [ ] 30-second market data refresh works

## 🚀 Your Live URLs

**GitHub Repository:**
https://github.com/vishalthindusthan-sys/wealth-growth-virtual-trading

**After Vercel Deploy:**
- Main App: `https://your-project-name.vercel.app`
- Automatically updates with every `git push`

## 📝 For Future Updates

Simple 3-step process:
```bash
# Step 1: Make changes to code
# Step 2: Commit & push
git add .
git commit -m "Your changes"
git push origin main

# Step 3: Wait 1-2 minutes - Vercel auto-deploys!
```

**IMPORTANT:** Never manually deploy. Just push to main branch!

## 🎯 Key Features Ready to Use

✅ User authentication (login/signup)
✅ Unlimited virtual balance
✅ Multi-market support (NSE, BSE, MCX, FOREX)
✅ 30-second live market data refresh
✅ Place buy/sell orders
✅ Track portfolio and P&L
✅ View open positions
✅ Order history
✅ Professional dashboard
✅ Dark mode UI

## 📱 Markets Available

**Equity:**
- NSE: RELIANCE, TCS, INFY, WIPRO, HDFC, ICICIBANK, SBIN, MARUTI
- Indices: NIFTY50, NIFTYBANK, NIFTYIT

**Commodities (MCX):**
- GOLD, SILVER, CRUDEOIL, NATURALGAS

**Forex:**
- USDINR, EURINR, GBPINR, JPYINR

## 🆘 Troubleshooting

**Q: Supabase connection failed?**
A: Check environment variables in Vercel are exactly as shown in Supabase Project Settings

**Q: "Invalid login" error?**
A: Ensure Supabase Auth is enabled in Project Settings → Authentication

**Q: Market data not loading?**
A: Verify API route `/api/positions` is accessible in deployed version

**Q: Can't place orders?**
A: Check orders and positions tables exist in Supabase SQL Editor

## 📞 Support Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs

---

**Ready to deploy?** You have everything you need! 🚀💰📈

## Database (Supabase)

This app shares the `quickbite-food-ordering` Supabase project
(`https://yeskyteushtqupecorlh.supabase.co`), because the organisation is at its
two free project limit. Every table is therefore prefixed `wgvt_`:

`wgvt_users`, `wgvt_instruments` (58 seeded instruments), `wgvt_orders`,
`wgvt_positions`, `wgvt_watchlists`, `wgvt_recommendations`, `wgvt_transactions`.

Table names live in `src/lib/tables.ts` — always import `TABLES` rather than
writing a name inline, so the prefix stays in one place.

Row Level Security is on for all seven tables. A signed-in user can read and
write only their own rows; `wgvt_instruments` and `wgvt_recommendations` are
world-readable but have no write policy, so only the service role can change
them. `.env.local` holds the project URL and the anon key;
`SUPABASE_SERVICE_ROLE_KEY` is still a placeholder — add it from the Supabase
dashboard (Settings → API) before running price updates that write to the
database.
