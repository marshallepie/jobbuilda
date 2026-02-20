# 🚀 Deployment Platform Guides

Quick deployment guides for hosting JobBuilda on popular platforms.

---

## 🎯 Current Production Deployment

**JobBuilda is currently deployed and operational using the following configuration:**

| Component | Platform | Domain | Status |
|-----------|----------|--------|--------|
| Admin Dashboard | **Vercel** | https://admin.jobbuilda.co.uk | ✅ Live |
| Client Portal | **Vercel** | https://portal.jobbuilda.co.uk | ✅ Live |
| API Backend | **Railway** | https://api.jobbuilda.co.uk | ✅ Live |
| Database | **Supabase** | PostgreSQL | ✅ Live |

**See [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) for full deployment details.**

---

## 📱 Frontend Deployment (Admin & Portal)

### Option 1: Vercel (Recommended) ⭐

**Why Vercel:**
- ✅ Best Next.js performance
- ✅ Automatic SSL
- ✅ Global CDN
- ✅ Zero config deployment
- ✅ Free tier available

**Deploy Admin Dashboard:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy admin
cd apps/admin
vercel --prod

# Follow prompts:
# - Project name: jobbuilda-admin
# - Framework: Next.js
# - Build command: (auto-detected)
# - Output directory: .next
```

**Configure Environment Variables in Vercel:**
1. Go to your project → Settings → Environment Variables
2. Add:
   - `NEXT_PUBLIC_API_URL` → Your API URL
   - `NEXT_PUBLIC_SUPABASE_URL` → Your Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Your Supabase anon key
   - `NEXT_PUBLIC_USE_MOCK_DATA` → false

**Deploy Portal:**
```bash
cd apps/portal
vercel --prod
```

**Custom Domains:**
1. Vercel Dashboard → Domains
2. Add: `admin.yourdomain.com` and `portal.yourdomain.com`
3. Update DNS records as instructed

---

### Option 2: Netlify

```bash
# Install Netlify CLI
npm i -g netlify-cli

# Deploy admin
cd apps/admin
netlify deploy --prod

# Deploy portal
cd apps/portal
netlify deploy --prod
```

**netlify.toml** (create in each app):
```toml
[build]
  command = "pnpm build"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

---

### Option 3: Cloudflare Pages

```bash
# Install Wrangler
npm i -g wrangler

# Deploy
cd apps/admin
npx @cloudflare/next-on-pages@latest
wrangler pages deploy .vercel/output/static
```

---

## 🖥️ Backend Deployment (Coordinator & MCP Services)

### Option 1: Railway (Recommended) ⭐

**Why Railway:**
- ✅ Easy Docker deployment
- ✅ Built-in PostgreSQL & NATS
- ✅ Automatic HTTPS
- ✅ Great for Node.js
- ✅ $5 free credit monthly

**Deploy Coordinator:**

1. **Create Dockerfile** (apps/coordinator/Dockerfile):
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/coordinator ./apps/coordinator

# Install dependencies
RUN npm install -g pnpm
RUN pnpm install --frozen-lockfile

# Build
RUN pnpm --filter @jobbuilda/coordinator build

FROM node:20-alpine
WORKDIR /app

# Copy built files
COPY --from=builder /app/apps/coordinator/dist ./dist
COPY --from=builder /app/apps/coordinator/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

2. **Deploy to Railway:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
cd apps/coordinator
railway init

# Add environment variables
railway variables set NODE_ENV=production
railway variables set PORT=3000
railway variables set JWT_SECRET=<your-secret>
railway variables set SUPABASE_URL=<your-url>
railway variables set SUPABASE_JWT_SECRET=<your-secret>
railway variables set DATABASE_URL=<your-db-url>

# Deploy
railway up
```

3. **Custom Domain:**
```bash
railway domain
# Follow prompts to add api.yourdomain.com
```

---

### Option 2: Render

**Deploy Coordinator:**

1. Connect GitHub repo
2. Create new Web Service
3. Configure:
   - **Build Command:** `cd apps/coordinator && pnpm install && pnpm build`
   - **Start Command:** `cd apps/coordinator && node dist/index.js`
   - **Environment:** Node
4. Add environment variables (from .env.production)
5. Deploy!

**render.yaml** (for infrastructure as code):
```yaml
services:
  - type: web
    name: jobbuilda-coordinator
    runtime: node
    buildCommand: cd apps/coordinator && pnpm install && pnpm build
    startCommand: cd apps/coordinator && node dist/index.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        sync: false
      - key: SUPABASE_JWT_SECRET
        sync: false
      - key: DATABASE_URL
        sync: false
```

---

### Option 3: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Launch app
cd apps/coordinator
fly launch

# Set secrets
fly secrets set JWT_SECRET=<your-secret>
fly secrets set SUPABASE_JWT_SECRET=<your-secret>
fly secrets set DATABASE_URL=<your-db-url>

# Deploy
fly deploy
```

**fly.toml:**
```toml
app = "jobbuilda-coordinator"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "3000"

[[services]]
  http_checks = []
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

---

## 💾 Database Options

### Option 1: Supabase PostgreSQL (Easiest)

Already configured! Just use:
```
postgresql://postgres:cWmXWvNZ%245BF3JQ@db.jnwxueomquywrqcgbgfd.supabase.co:5432/postgres
```

**Pros:**
- ✅ Already set up
- ✅ Integrated with auth
- ✅ Free tier: 500MB
- ✅ Automatic backups

**Cons:**
- ⚠️ Shared database for all services (need tenant isolation)

---

### Option 2: Neon (Serverless PostgreSQL)

**Why Neon:**
- ✅ Serverless (pay per use)
- ✅ Instant branching
- ✅ Generous free tier
- ✅ Great for development

```bash
# Sign up: https://neon.tech
# Create project
# Get connection string
# Update DATABASE_URL in all services
```

---

### Option 3: Railway PostgreSQL

```bash
railway add postgresql
railway variables
# Copy DATABASE_URL
```

---

## 📨 Message Bus (NATS)

### Option 1: Self-Hosted NATS (Docker)

```yaml
# docker-compose.yml
version: '3.8'
services:
  nats:
    image: nats:latest
    ports:
      - "4222:4222"
    command: "--jetstream"
```

---

### Option 2: Synadia Cloud (Managed NATS)

1. Sign up: https://www.synadia.com/cloud
2. Create account
3. Get connection URL
4. Update NATS_URL in all services

---

### Option 3: Railway NATS

```bash
# Use NATS Docker template
railway add nats
```

---

## 🎯 Recommended Setup for Launch

**For Quick Launch (Easiest):**

| Component | Platform | Why |
|-----------|----------|-----|
| Admin Frontend | Vercel | Best Next.js support |
| Portal Frontend | Vercel | Best Next.js support |
| Backend (Coordinator) | Railway | Easy Node.js deployment |
| Database | Supabase | Already configured |
| NATS | Railway Docker | Simple setup |
| Monitoring | Free tier (Grafana Cloud) | Good enough to start |

**Total Cost:** ~$20-30/month

---

**For Production Scale:**

| Component | Platform | Why |
|-----------|----------|-----|
| Admin Frontend | Vercel | Performance |
| Portal Frontend | Vercel | Performance |
| Backend | AWS ECS / GCP Cloud Run | Scalability |
| Database | Neon / AWS RDS | Dedicated |
| NATS | Synadia Cloud | Managed |
| Monitoring | Datadog / New Relic | Full observability |

**Total Cost:** ~$100-500/month

---

## 🚀 Quick Deploy Commands

```bash
# 1. Set up production configs
./scripts/setup-production.sh

# 2. Deploy frontend (Vercel)
cd apps/admin && vercel --prod
cd apps/portal && vercel --prod

# 3. Deploy backend (Railway)
cd apps/coordinator && railway up

# 4. Configure DNS
# Point domains to deployments

# 5. Test!
curl https://api.yourdomain.com/health
```

---

## 📋 Environment Variables Checklist

**Coordinator (Railway/Render):**
- [ ] NODE_ENV=production
- [ ] PORT=3000
- [ ] JWT_SECRET
- [ ] SUPABASE_URL
- [ ] SUPABASE_JWT_SECRET
- [ ] DATABASE_URL
- [ ] NATS_URL

**Admin (Vercel/Netlify):**
- [ ] NEXT_PUBLIC_API_URL
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY
- [ ] NEXT_PUBLIC_USE_MOCK_DATA=false

**Portal (Vercel/Netlify):**
- [ ] NEXT_PUBLIC_API_URL
- [ ] NEXT_PUBLIC_SUPABASE_URL
- [ ] NEXT_PUBLIC_SUPABASE_ANON_KEY

---

## 🆘 Troubleshooting

**Frontend not loading:**
- Check NEXT_PUBLIC_API_URL points to deployed API
- Verify environment variables in hosting dashboard
- Check browser console for errors

**Backend not connecting to database:**
- Verify DATABASE_URL is correct
- Check if password has special characters (URL encode!)
- Test connection locally first

**Authentication not working:**
- Verify SUPABASE_JWT_SECRET matches Supabase dashboard
- Check JWT_SECRET is same across all services
- Test with curl: `curl -H "Authorization: Bearer <token>" https://api.yourdomain.com/api/health`

**CORS errors:**
- Update CORS origins in coordinator to include your domains
- Check Supabase Auth redirect URLs include your domains

---

**Need help? Check the main PRODUCTION_DEPLOYMENT.md for full checklist!**
