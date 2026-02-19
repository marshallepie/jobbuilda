# 🚀 LAUNCH NOW - Quick Start Guide

**Ready to go live in 30 minutes!**

---

## ⚡ 30-Minute Launch Plan

### Minute 0-5: Production Setup

```bash
# Run the automated setup script
./scripts/setup-production.sh
```

**What it does:**
- ✅ Generates strong production secrets
- ✅ Collects your Supabase JWT secret
- ✅ Creates production .env files
- ✅ Configures domains

**You'll need:**
- Your domain name (e.g., jobbuilda.com)
- Supabase JWT secret (from dashboard)

---

### Minute 5-10: Supabase Configuration

1. **Set Site URL:**
   - Go to: https://supabase.com/dashboard/project/jnwxueomquywrqcgbgfd/auth/url-configuration
   - Site URL: `https://admin.yourdomain.com`
   - Save

2. **Add Redirect URLs:**
   - Add: `https://admin.yourdomain.com/auth/callback`
   - Add: `https://admin.yourdomain.com/*`
   - Save

3. **Verify Email Templates** (already done ✅)

---

### Minute 10-20: Deploy Frontend

**Option A: Vercel (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy admin
cd apps/admin
vercel --prod
# When prompted for env vars, use values from .env.production

# Deploy portal
cd apps/portal
vercel --prod
```

**Option B: One-Click Deploy**

[![Deploy Admin to Vercel](https://vercel.com/button)](https://vercel.com/new/clone)
[![Deploy Portal to Vercel](https://vercel.com/button)](https://vercel.com/new/clone)

---

### Minute 20-25: Deploy Backend

**Option A: Railway (Easiest)**

```bash
# Install Railway CLI
npm i -g @railway/cli

# Deploy coordinator
cd apps/coordinator
railway login
railway init
railway up
```

**Option B: Use Railway Dashboard**
1. Go to: https://railway.app
2. "New Project" → "Deploy from GitHub"
3. Select your repo
4. Add environment variables from `.env.production`
5. Deploy!

---

### Minute 25-28: Configure DNS

Point your domains to the deployments:

```
# Get deployment URLs from Vercel/Railway
admin.yourdomain.com  → CNAME to vercel-deployment-url
portal.yourdomain.com → CNAME to vercel-deployment-url
api.yourdomain.com    → CNAME to railway-deployment-url
```

**DNS Propagation:** May take 5-60 minutes

---

### Minute 28-30: Test & Celebrate! 🎉

```bash
# Test API
curl https://api.yourdomain.com/health

# Test admin dashboard
open https://admin.yourdomain.com

# Test portal
open https://portal.yourdomain.com
```

**Test checklist:**
- [ ] Admin dashboard loads
- [ ] Can sign up new user
- [ ] Can create a client
- [ ] Portal loads
- [ ] API responds to requests

---

## 🎯 Immediate Next Steps

### Step 1: Run Production Setup

```bash
cd /Users/marshallepie/Desktop/dev/JobBuilda
./scripts/setup-production.sh
```

### Step 2: Choose Your Hosting

**Easiest Path (Recommended for launch):**
- Frontend: Vercel (free tier)
- Backend: Railway ($5/month)
- Database: Supabase (already configured)
- Total time: 15 minutes
- Total cost: $5/month

**Alternative Paths:**
- See `DEPLOYMENT_PLATFORMS.md` for other options

### Step 3: Deploy!

Follow the platform-specific guide in `DEPLOYMENT_PLATFORMS.md`

---

## 📞 Need Help?

**Common Issues:**

1. **"Missing Supabase JWT Secret"**
   - Get from: https://supabase.com/dashboard/project/jnwxueomquywrqcgbgfd/settings/api
   - Copy the JWT Secret (NOT anon key)

2. **"Build failed on Vercel"**
   - Check environment variables are set
   - Verify NEXT_PUBLIC_API_URL is correct

3. **"Can't connect to database"**
   - Check DATABASE_URL has special chars URL-encoded
   - `$` should be `%24`

4. **"CORS error"**
   - Update CORS origins in coordinator
   - Add your production domains

---

## 🎉 Post-Launch Checklist

Once live:

- [ ] Create your first real account
- [ ] Test complete workflow (lead → quote → job → invoice)
- [ ] Invite a test client to portal
- [ ] Monitor error logs (first 24 hours)
- [ ] Set up backups
- [ ] Share with the world! 🌍

---

## 💰 Cost Breakdown

**Free Tier (Testing):**
- Vercel: Free (hobby)
- Supabase: Free (up to 500MB)
- Railway: $5 credit
- **Total: $0-5/month**

**Production (Real Users):**
- Vercel: Free - $20/month
- Railway: $5-20/month
- Supabase: $25/month (Pro)
- Domain: $12/year
- **Total: $30-65/month**

---

## 🚀 You're Ready!

Everything is configured and ready to deploy.

**Run this now to start:**

```bash
./scripts/setup-production.sh
```

Then follow the deployment guide for your chosen platform!

**Let's go live! 🎉🚀**
