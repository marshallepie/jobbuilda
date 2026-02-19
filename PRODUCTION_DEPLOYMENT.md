# 🚀 JobBuilda Production Deployment Checklist

**Status:** Ready to Deploy
**Last Updated:** 2026-02-17

---

## 📋 Pre-Deployment Checklist

### Phase 1: Database & Infrastructure ⚙️

- [ ] **1.1 Database Decision**
  - Option A: Use Supabase PostgreSQL (easier, managed)
  - Option B: Use separate PostgreSQL service (Neon, Railway, etc.)
  - Decision: _______________

- [ ] **1.2 NATS Message Bus**
  - Option A: Self-hosted NATS cluster
  - Option B: Managed NATS service (Synadia Cloud)
  - Option C: Replace with different message broker
  - Decision: _______________

- [ ] **1.3 Hosting Platform**
  - Frontend (Admin): Vercel / Netlify / Cloudflare Pages
  - Frontend (Portal): Vercel / Netlify / Cloudflare Pages
  - Backend (Coordinator): Railway / Render / Fly.io / AWS
  - MCP Services: Railway / Render / Fly.io / AWS
  - Decision: _______________

---

### Phase 2: Supabase Configuration 🔐

- [ ] **2.1 Get JWT Secret**
  - Go to: https://supabase.com/dashboard/project/jnwxueomquywrqcgbgfd/settings/api
  - Copy JWT Secret
  - Store securely

- [ ] **2.2 Configure Auth Settings**
  - Site URL: Your production domain
  - Redirect URLs: Add all production callback URLs
  - Disable email confirmations (if needed)
  - Set token expiry times

- [ ] **2.3 Email Templates** ✅ (Already configured)
  - Confirm signup template
  - Password reset template
  - Magic link template

- [ ] **2.4 SMTP Configuration**
  - Service: SendGrid / AWS SES / Mailgun / Postmark
  - Configure sender email: noreply@yourdomain.com
  - Configure sender name: JobBuilda
  - Test emails

- [ ] **2.5 Row Level Security (RLS)**
  - Only needed if using Supabase PostgreSQL
  - Enable RLS on all tables
  - Create tenant isolation policies
  - Test with multiple tenants

---

### Phase 3: Security Hardening 🔒

- [ ] **3.1 Generate Production Secrets**
  ```bash
  # Generate strong JWT secret
  openssl rand -base64 32
  ```

- [ ] **3.2 Update All JWT_SECRET Values**
  - apps/coordinator/.env
  - services/identity-mcp/.env
  - services/clients-mcp/.env
  - services/quoting-mcp/.env
  - services/jobs-mcp/.env
  - (All MCP services must use SAME secret)

- [ ] **3.3 Configure CORS**
  - Restrict to production domains only
  - Remove `origin: true` from development

- [ ] **3.4 Enable JWT Validation**
  - Update coordinator routes to use validateSupabaseToken
  - Test with real Supabase tokens
  - Remove mock auth code paths

- [ ] **3.5 Environment Variables Security**
  - Never commit .env files
  - Use hosting platform's secret management
  - Rotate secrets regularly

---

### Phase 4: Database Migration 💾

**If using Supabase PostgreSQL:**

- [ ] **4.1 Update Database URLs**
  - Update DATABASE_URL in all services
  - URL format: `postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres`
  - Remember to URL-encode special characters in password

- [ ] **4.2 Run Migrations**
  ```bash
  cd services/identity-mcp && pnpm db:migrate
  cd services/clients-mcp && pnpm db:migrate
  cd services/quoting-mcp && pnpm db:migrate
  cd services/jobs-mcp && pnpm db:migrate
  # ... repeat for all services
  ```

- [ ] **4.3 Seed Initial Data** (if needed)

- [ ] **4.4 Set Up RLS Policies**
  - Run SQL scripts for each table
  - Test tenant isolation

**If using separate PostgreSQL:**

- [ ] **4.1 Provision PostgreSQL Instance**
- [ ] **4.2 Get Connection Strings**
- [ ] **4.3 Run Migrations**
- [ ] **4.4 Configure Backups**

---

### Phase 5: Frontend Deployment 🎨

**Admin Dashboard (`apps/admin`)**

- [ ] **5.1 Production Environment Variables**
  ```bash
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com
  NEXT_PUBLIC_SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  NEXT_PUBLIC_USE_MOCK_DATA=false
  ```

- [ ] **5.2 Build & Deploy**
  ```bash
  cd apps/admin
  pnpm build
  # Deploy to Vercel/Netlify
  ```

- [ ] **5.3 Configure Custom Domain**
  - admin.yourdomain.com
  - SSL/TLS certificate

**Client Portal (`apps/portal`)**

- [ ] **5.4 Production Environment Variables**
  ```bash
  NEXT_PUBLIC_API_URL=https://api.yourdomain.com
  NEXT_PUBLIC_SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```

- [ ] **5.5 Build & Deploy**
  ```bash
  cd apps/portal
  pnpm build
  # Deploy to Vercel/Netlify
  ```

- [ ] **5.6 Configure Custom Domain**
  - portal.yourdomain.com
  - SSL/TLS certificate

---

### Phase 6: Backend Deployment 🖥️

**Coordinator (`apps/coordinator`)**

- [ ] **6.1 Production Environment Variables**
  ```bash
  PORT=3000
  NODE_ENV=production
  DATABASE_URL=postgresql://...
  NATS_URL=nats://...
  JWT_SECRET=<strong-production-secret>
  SUPABASE_URL=https://jnwxueomquywrqcgbgfd.supabase.co
  SUPABASE_JWT_SECRET=<from-supabase-dashboard>
  OTEL_EXPORTER_OTLP_ENDPOINT=<your-otel-endpoint>
  OTEL_SERVICE_NAME=coordinator
  ```

- [ ] **6.2 Build & Deploy**
  ```bash
  cd apps/coordinator
  pnpm build
  # Deploy to Railway/Render/Fly.io
  ```

- [ ] **6.3 Configure Custom Domain**
  - api.yourdomain.com
  - SSL/TLS certificate

**MCP Services**

- [ ] **6.4 Deploy All MCP Services**
  - identity-mcp
  - clients-mcp
  - suppliers-mcp
  - quoting-mcp
  - jobs-mcp
  - materials-mcp
  - variations-mcp
  - tests-mcp
  - invoicing-mcp
  - payments-mcp
  - reporting-mcp

- [ ] **6.5 Configure Service Communication**
  - Ensure all services can reach NATS
  - Ensure coordinator can spawn MCP services
  - Test service-to-service communication

---

### Phase 7: Monitoring & Observability 📊

- [ ] **7.1 OpenTelemetry Setup**
  - Choose backend: Grafana Cloud / Honeycomb / Datadog
  - Configure OTEL_EXPORTER_OTLP_ENDPOINT in all services
  - Test distributed tracing

- [ ] **7.2 Error Tracking**
  - Set up Sentry / Rollbar
  - Add to frontend and backend
  - Test error reporting

- [ ] **7.3 Logging**
  - Centralized logging: Logtail / Better Stack / Papertrail
  - Configure log levels (warn/error in production)
  - Set up alerts

- [ ] **7.4 Uptime Monitoring**
  - UptimeRobot / Pingdom / Better Uptime
  - Monitor admin, portal, and API endpoints
  - Set up alerts

- [ ] **7.5 Performance Monitoring**
  - Vercel Analytics (for Next.js apps)
  - API response time monitoring
  - Database query performance

---

### Phase 8: CI/CD Setup 🔄

- [ ] **8.1 GitHub Actions**
  - Build and test on PR
  - Deploy on merge to main
  - Separate workflows for frontend/backend

- [ ] **8.2 Environment Branches**
  - main → production
  - staging → staging environment (optional)
  - develop → development environment

- [ ] **8.3 Automated Tests**
  - Run tests before deployment
  - Block deployment on test failures

---

### Phase 9: DNS & Domain Configuration 🌐

- [ ] **9.1 Purchase Domain** (if not already owned)

- [ ] **9.2 Configure DNS Records**
  ```
  admin.yourdomain.com    → Vercel/Netlify
  portal.yourdomain.com   → Vercel/Netlify
  api.yourdomain.com      → Railway/Render
  ```

- [ ] **9.3 SSL Certificates**
  - Automatic via hosting provider
  - Verify HTTPS works

---

### Phase 10: Final Testing 🧪

- [ ] **10.1 User Flows**
  - Sign up new user
  - Create client
  - Create quote
  - Convert quote to job
  - Log time
  - Create invoice
  - Send invoice
  - Client portal access
  - Payment flow

- [ ] **10.2 Multi-Tenancy Testing**
  - Create 2+ test accounts
  - Verify data isolation
  - Test with different tenant_ids

- [ ] **10.3 Email Testing**
  - Signup confirmation
  - Password reset
  - Invoice emails
  - Quote emails

- [ ] **10.4 Security Testing**
  - Try accessing other tenant's data
  - Test JWT expiration
  - Test invalid tokens
  - Test CORS restrictions

- [ ] **10.5 Performance Testing**
  - Load test API endpoints
  - Check page load times
  - Test with large datasets

- [ ] **10.6 Mobile Testing**
  - Test admin on mobile
  - Test portal on mobile
  - Verify PWA functionality

---

### Phase 11: Launch Preparation 🎉

- [ ] **11.1 Documentation**
  - User guide for admin dashboard
  - Client portal instructions
  - API documentation (if public)

- [ ] **11.2 Backup Strategy**
  - Database backups enabled
  - Backup retention policy
  - Test restore procedure

- [ ] **11.3 Support Setup**
  - Support email configured
  - Issue tracking system
  - User feedback mechanism

- [ ] **11.4 Legal & Compliance**
  - Privacy policy
  - Terms of service
  - GDPR compliance (if EU users)
  - Cookie consent

- [ ] **11.5 Marketing Materials**
  - Landing page
  - Demo video
  - Screenshots
  - Social media presence

---

## 🎯 Launch Day Checklist

- [ ] All production services running
- [ ] Monitoring dashboards active
- [ ] Support channels ready
- [ ] Backup verified
- [ ] Test user account created
- [ ] Announcement prepared
- [ ] Press "Go Live" button! 🚀

---

## 📞 Post-Launch

- [ ] Monitor error rates (first 24 hours)
- [ ] Check performance metrics
- [ ] Respond to user feedback
- [ ] Fix critical issues immediately
- [ ] Celebrate! 🎉🥳

---

## 🆘 Rollback Plan

If something goes wrong:

1. **Immediate Actions:**
   - Revert to previous deployment
   - Switch DNS back to maintenance page
   - Notify users of issue

2. **Investigation:**
   - Check error logs
   - Review monitoring dashboards
   - Identify root cause

3. **Fix & Redeploy:**
   - Apply fix
   - Test in staging
   - Deploy when stable

---

## 📝 Notes

**Critical Secrets to Configure:**
- JWT_SECRET (same across all services)
- SUPABASE_JWT_SECRET (from Supabase dashboard)
- DATABASE_URL (production PostgreSQL)
- NATS_URL (production message bus)
- SMTP credentials (for emails)

**Cost Estimates:**
- Supabase (Free tier / Pro: $25/month)
- Hosting: ~$20-50/month (Railway/Render)
- Domain: ~$10-15/year
- Monitoring: Free tier available
- Total: ~$30-75/month initially

---

**Last Updated:** 2026-02-17
**Status:** Ready to configure ✅
