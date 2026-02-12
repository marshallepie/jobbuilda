# 🧰 JobBuilda – Product & Functional Requirements Document (PRD + FRD)

**Version:** v1.0 (MVP Scope)  
**Date:** October 2025  
**Owner:** Marshall Epie  
**Repository:** [github.com/marshallepie/jobbuilda](https://github.com/marshallepie/jobbuilda)

---

## 📘 Table of Contents
1. [Overview](#1-overview)
2. [Core Value Proposition](#2-core-value-proposition)
3. [Tagline](#3-tagline)
4. [Target Users (Personas)](#4-target-users-personas)
5. [Product Goals & Success Metrics](#5-product-goals--success-metrics)
6. [End-to-End Workflows (MVP)](#6-end-to-end-workflows-mvp)
7. [System Roles & Permissions](#7-system-roles--permissions)
8. [Functional Requirements](#8-functional-requirements)
9. [Non-Functional Requirements](#9-non-functional-requirements)
10. [Data Model](#10-data-model-v1-postgres--supabase)
11. [API Surface](#11-api-surface-v1-rest)
12. [Supplier Price Integration](#12-supplier-price-integration)
13. [Payments & Billing](#13-payments--billing)
14. [Client Portal](#14-client-portal)
15. [Offline & Sync Logic](#15-offline--sync-logic)
16. [Reporting & Exports](#16-reporting--exports)
17. [Notifications & Reminders](#17-notifications--reminders)
18. [Reporting Endpoints](#18-reporting-endpoints)
19. [Tech Stack](#19-tech-stack)
20. [Milestones / Sprints](#20-milestones--sprints)
21. [Risks & Mitigation](#21-risks--mitigation)
22. [Future Roadmap](#22-future-roadmap-post-mvp)
23. [Appendix – Sample Payloads](#23-appendix--sample-payloads)
24. [Ownership & Governance](#24-ownership--governance)

---

## 1. Overview
**JobBuilda** is a **mobile-first, fully responsive job management app** for **solo tradesmen** (starting with electricians).  
It enables seamless workflow from **lead → quote → job sheet → on-site capture → invoice → accounts/tax**, with a **live client portal** and **real-time material prices** from wholesalers.

---

## 2. Core Value Proposition
Empower independent tradespeople to run their entire operation from their phone — quoting, tracking, invoicing, and compliance — without complex accounting software.

---

## 3. Tagline
> **“Quote → Work → Get Paid — Anywhere.”**

---

## 4. Target Users (Personas)
| Persona | Description | Key Needs |
|----------|--------------|-----------|
| **Owner / Technician** | Self-employed tradesman managing all jobs, finances, and clients. | Quick quotes, on-site job tracking, automated invoicing, tax overview. |
| **Additional Tech / Staff** | Optional team members or subcontractors. | Assigned job view, time/material entry, media uploads, test results. |
| **Client** | Customer receiving service. | Approve quotes, track progress, pay invoices, access certificates. |

---

## 5. Product Goals & Success Metrics
| Goal | Success Metric (M1 Target) |
|------|-----------------------------|
| Reduce admin time | < 7 min to create + send a quote |
| Automate billing | 90% of invoices auto-assembled from job data |
| Speed on-site logging | ≤ 60 s to add a material (barcode / SKU) |
| Faster payments | DSO < 10 days (via client portal) |
| Offline reliability | Zero data loss after reconnect sync |

---

## 6. End-to-End Workflows (MVP)
### A. Lead → Quote
- Create lead with client/site info, photos/videos.
- Build quote with: labour, materials (live supplier prices + markup), fees, VAT toggle.
- Send quote link → client approves/signs → auto-convert to Job.

### B. Quote → Job Sheet
- Auto-create Job (unique ID, schedule, checklist, compliance docs).
- Assign technicians.
- Mobile Job Sheet includes: client/site/scope, materials, time tracker, GPS stamps, photos/videos.

### C. On-Site Execution
- Start/Pause/Stop timers.
- Add/scan materials (barcode/SKU).
- Capture test results, photos/videos.
- Generate variations → client approves.

### D. Completion → Invoice
- Auto-generate invoice: labour + materials + fees + VAT.
- Send via client portal → Stripe payment.

### E. Accounting & Tax
- Cashbook & P&L snapshot.
- Export CSV / Excel.
- VAT & income summaries.

### F. Client Management & Upsell
- Job history per client/site.
- Smart reminders (safety checks, warranty, annual service).
- One-click quote from templates or previous jobs.

---

## 7. System Roles & Permissions
| Role | Permissions Summary |
|------|----------------------|
| **Owner / Technician** | Full CRUD; billing; exports; manages users; sets rates & markup. |
| **Additional Tech** | Read assigned jobs; log time/materials/media/tests; no pricing access. |
| **Client** | View quotes/jobs/invoices; approve & pay; download certificates. |

---

## 8. Functional Requirements
### Core Modules
1. Lead & Quote Management
2. Job Scheduling & Execution
3. Materials & Inventory
4. Tests & Compliance
5. Invoicing & Payments
6. Accounts & Tax
7. Client Portal

---

## 9. Non-Functional Requirements
| Category | Requirement |
|-----------|--------------|
| Platform | PWA (React + Supabase + Node) |
| Security | RLS per tenant; signed portal tokens; audit log |
| Media | Client compression + resumable uploads |
| Performance | <2s API latency; <300ms UI actions |
| Offline | IndexedDB cache; LWW conflict resolution |
| Compliance | HMRC VAT rules; GDPR data retention |

---

## 10. Data Model (v1, Postgres / Supabase)
```sql
-- simplified schema (see full doc in /db/schema.sql)
create table users (...);
create table clients (...);
create table leads (...);
create table quotes (...);
create table jobs (...);
create table invoices (...);
```
*(Full SQL schema included in /db/migrations/001_init.sql)*

---

## 11. API Surface (v1 REST)
| Endpoint | Method | Description |
|-----------|---------|-------------|
| /leads | POST | Create new lead |
| /quotes | POST/GET | Create or fetch quote |
| /jobs/{id}/materials | POST | Add scanned material |
| /invoices/{id}/pay | POST | Stripe payment webhook |
| /portal/q/{token} | GET | Client quote view |

---

## 12. Supplier Price Integration
Adapters per supplier normalize to `{sku, desc, price_ex_vat}`.  
Cache TTL = 24h; manual refresh; fallback to cached if offline.

---

## 13. Payments & Billing
Stripe Checkout integration; partial payments supported.  
Webhooks update payments table and invoice status automatically.

---

## 14. Client Portal
| URL | Purpose |
|------|----------|
| /portal/q/{token} | Approve quote |
| /portal/j/{token} | Live job progress |
| /portal/i/{token} | Pay invoice / download certs |

---

## 15. Offline & Sync Logic
- Local storage queue (leads, jobs, time, materials, media)
- Retry every 5 min
- Conflict resolution: last writer wins per field

---

## 16. Reporting & Exports
Cashbook, P&L, VAT summaries, CSV exports (Xero/QB v2 planned).

---

## 17. Notifications & Reminders
| Trigger | Action |
|----------|--------|
| Quote approved | Notify owner |
| Invoice due soon | Client email reminder |
| Safety check due | Auto task create |

---

## 18. Reporting Endpoints
- /reports/pnl  
- /reports/tax  
- /reports/client/{id}

---

## 19. Tech Stack
| Layer | Tech |
|--------|------|
| Frontend | React (PWA) + Tailwind |
| Backend | Node / Supabase Edge Functions |
| Database | Postgres (RLS) |
| Auth | Supabase Auth |
| Payments | Stripe |
| Storage | Supabase Storage |
| Deployment | Netlify / Supabase |

---

## 20. Milestones / Sprints
| Sprint | Focus | Deliverables |
|---------|--------|--------------|
| 1 | Quotes | Auth, Clients, Quotes, Price Pull |
| 2 | Jobs | Job Sheets, Timers, Materials |
| 3 | Billing | Invoices, Stripe Pay, Reports |

---

## 21. Risks & Mitigation
| Risk | Mitigation |
|------|-------------|
| Supplier APIs unreliable | Cache + manual override |
| Offline sync conflicts | Field-level merge |
| Media bloat | Compression + chunked uploads |
| VAT miscalculation | Shared pricing util |

---

## 22. Future Roadmap (Post-MVP)
- Multi-trade support
- AI quote assistant
- Supplier auto-ordering
- Full Xero/QuickBooks sync
- AO / MCP agent orchestration

---

## 23. Appendix – Sample Payloads
```json
{
  "lead_id": "uuid",
  "items": [
    {"kind":"labour","description":"Install socket","qty":2,"unit_price":55},
    {"kind":"material","sku":"MK-123","qty":20,"unit_price":0.85}
  ]
}
```

---

## 24. Ownership & Governance
| Area | Owner |
|-------|--------|
| Product Vision | Marshall Epie |
| Engineering | Lead Engineer |
| Design | UI/UX Lead |
| QA | QA Engineer |
| Supplier APIs | Product Ops |

---

**End of Document – JobBuilda PRD/FRD v1.0**
