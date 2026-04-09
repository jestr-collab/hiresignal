# HireSignal — Cursor Build Plan
> Hiring signal intelligence for B2B SaaS sales teams.
> Follow this file top to bottom. Each step is a single Cursor prompt. Tag this file with `@BUILDPLAN.md` at the start of every prompt so Cursor always has full context.

---

## What We're Building

A SaaS product that:
1. Scrapes job boards nightly for sales hiring signals
2. Filters and scores those signals
3. Enriches them with company + contact data
4. Displays them in a clean dashboard
5. Emails a weekly digest to subscribers
6. Charges $299/month via Stripe

**Stack:** Next.js · Supabase · Playwright · Apollo API · Resend · Clerk · Stripe · Railway

---

## Folder Structure (target state)

```
hiresignal/
├── app/                        # Next.js app router
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx            # Main signals table
│   │   └── signal/[id]/page.tsx
│   ├── api/
│   │   ├── webhooks/
│   │   │   └── stripe/route.ts
│   │   └── cron/
│   │       ├── scrape/route.ts
│   │       ├── filter/route.ts
│   │       ├── enrich/route.ts
│   │       └── digest/route.ts
│   └── layout.tsx
├── components/
│   ├── SignalCard.tsx
│   ├── SignalTable.tsx
│   ├── SignalFilters.tsx
│   └── ExportButton.tsx
├── lib/
│   ├── supabase.ts             # Supabase client
│   ├── apollo.ts               # Apollo API wrapper
│   ├── scraper.ts              # Playwright scraper logic
│   ├── filter.ts               # Signal keyword filter
│   ├── enrichment.ts           # Enrichment pipeline
│   └── email.ts                # Resend email sender
├── scripts/
│   └── seed-companies.ts       # One-time seed script
├── types/
│   └── index.ts                # Shared TypeScript types
├── .env.local                  # All API keys (never commit)
└── BUILDPLAN.md                # This file
```

---

## Environment Variables

Create `.env.local` in root. Fill these in as you get API keys.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk (auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_PRICE_ID=                    # Your $299/mo price ID

# Apollo.io
APOLLO_API_KEY=

# Resend (email)
RESEND_API_KEY=

# Cron security
CRON_SECRET=any-random-string-you-choose
```

---

## Database Schema (Supabase)

Run this SQL in your Supabase SQL editor. Do this before any code steps.

```sql
-- Companies we track
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text unique not null,
  greenhouse_url text,
  lever_url text,
  size_range text,
  funding_stage text,
  funding_amount text,
  funding_date text,
  linkedin_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Raw job postings from scraper
create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  title text not null,
  description text,
  location text,
  job_url text,
  board text,                         -- 'greenhouse' | 'lever' | 'ashby'
  posted_date date,
  scraped_at timestamptz default now(),
  is_active boolean default true,
  unique(company_id, job_url)
);

-- Filtered buying signals
create table signals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  signal_type text not null,          -- 'vp_sales' | 'revops' | 'sdr_team' | 'cro'
  signal_strength text default 'medium', -- 'high' | 'medium' | 'low'
  score integer default 50,           -- 0-100
  job_count integer default 1,        -- how many signal jobs at this company
  job_ids uuid[],                     -- array of job IDs that triggered this
  context text,                       -- human-readable explanation
  detected_at timestamptz default now(),
  is_new boolean default true,        -- cleared after first digest
  week_of date                        -- Monday of the week detected
);

-- Enriched contacts per company
create table contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references companies(id) on delete cascade,
  first_name text,
  last_name text,
  title text,
  email text,
  linkedin_url text,
  seniority text,                     -- 'vp' | 'director' | 'manager' | 'c_suite'
  source text default 'apollo',
  enriched_at timestamptz default now()
);

-- Subscribers (synced from Stripe/Clerk)
create table subscribers (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text unique not null,
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  plan text default 'trial',          -- 'trial' | 'active' | 'cancelled'
  trial_ends_at timestamptz,
  created_at timestamptz default now()
);

-- Indexes for performance
create index on jobs(company_id);
create index on jobs(scraped_at);
create index on signals(company_id);
create index on signals(week_of);
create index on signals(score desc);
create index on contacts(company_id);
create index on subscribers(clerk_user_id);
```

---

## Step-by-Step Build Prompts

> How to use: Copy each prompt block exactly. Paste into Cursor chat. Tag `@BUILDPLAN.md` at the start of every prompt. Complete one step fully before moving to the next.

---

### STEP 1 — Project Setup

**Cursor prompt:**
```
@BUILDPLAN.md

Set up a new Next.js 14 project called "hiresignal" using the app router with TypeScript and Tailwind. Then:

1. Install these packages:
   - @supabase/supabase-js
   - @clerk/nextjs
   - stripe
   - @stripe/stripe-js
   - resend
   - playwright
   - @types/node

2. Create the full folder structure exactly as defined in BUILDPLAN.md

3. Create /types/index.ts with TypeScript interfaces for: Company, Job, Signal, Contact, Subscriber — matching the Supabase schema in BUILDPLAN.md exactly

4. Create /lib/supabase.ts with a Supabase client using the env vars in BUILDPLAN.md

5. Create .env.local with all the empty env var keys from BUILDPLAN.md

Do not fill in any API keys. Just scaffold the structure.
```

**Done when:** Project runs with `npm run dev` and folder structure matches the plan.

---

### STEP 2 — Seed the Company List

**Cursor prompt:**
```
@BUILDPLAN.md

Create /scripts/seed-companies.ts that seeds our companies table in Supabase with 100 well-known B2B SaaS companies that use Greenhouse or Lever for hiring.

For each company include:
- name
- domain
- greenhouse_url (format: https://boards.greenhouse.io/{company-slug})
- lever_url (format: https://jobs.lever.co/{company-slug})
- size_range (approximate: "1-50" | "51-200" | "201-500" | "500+")

read from the file @companies.csv 
in the project root using Node's fs module and parse it with 
the csv-parse library. Upsert each row into the companies table.


Use the Supabase service role key to insert. Add a check to skip companies already in the DB (upsert on domain).

Add a package.json script: "seed": "ts-node scripts/seed-companies.ts"
```

**Done when:** `npm run seed` inserts 100 companies into Supabase with no errors.

---

### STEP 3 — The Scraper

**Cursor prompt:**
```
@BUILDPLAN.md

Create /lib/scraper.ts with a scrapeCompanyJobs() function that:

1. Takes a Company object (from our types) as input
2. Uses Playwright (headless Chromium) to visit the company's Greenhouse job board URL
3. Finds all job listings on the page — each listing has a title, link, and sometimes a location
4. For Greenhouse: parse the DOM at https://boards.greenhouse.io/{slug} — job titles are in <a> tags inside .opening divs
5. Returns an array of raw job objects: { title, job_url, location, board: 'greenhouse', posted_date: today }
6. Handles errors gracefully — if a company page 404s or times out, log it and return empty array (don't crash the whole run)
7. Adds a 1-2 second delay between page visits to avoid rate limiting

Also create /app/api/cron/scrape/route.ts that:
1. Validates the CRON_SECRET header for security
2. Fetches all companies from Supabase
3. Loops through each company, calls scrapeCompanyJobs()
4. Upserts raw jobs into the jobs table (unique on company_id + job_url)
5. Returns a summary: { companiesScraped: N, jobsFound: N, newJobs: N }

Use the POST method. Add proper TypeScript types throughout.
```

**Done when:** Calling the `/api/cron/scrape` endpoint with the correct header scrapes jobs and stores them in Supabase.

---

### STEP 4 — Signal Filter

**Cursor prompt:**
```
@BUILDPLAN.md

Create /lib/filter.ts with a classifyJob() function that:

1. Takes a job title string as input
2. Returns a signal classification object or null (if not a buying signal):
   {
     signal_type: 'vp_sales' | 'cro' | 'sdr_team' | 'ae_team' | 'revops' | 'sales_enablement' | 'crm_admin',
     signal_strength: 'high' | 'medium' | 'low',
     base_score: number  // 0-100
   }

Use these rules:
- 'vp_sales': titles containing "VP Sales", "VP of Sales", "Head of Sales", "Director of Sales" → score 85, strength 'high'
- 'cro': titles containing "Chief Revenue", "CRO", "Chief Sales" → score 95, strength 'high'
- 'sdr_team': titles containing "SDR", "BDR", "Business Development Rep", "Sales Development" → score 70, strength 'medium'
- 'ae_team': titles containing "Account Executive", "AE", "Account Manager" (when hiring 2+) → score 65, strength 'medium'
- 'revops': titles containing "Revenue Operations", "RevOps", "Sales Operations", "Sales Ops" → score 80, strength 'high'
- 'sales_enablement': titles containing "Sales Enablement", "Enablement Manager" → score 75, strength 'high'
- 'crm_admin': titles containing "CRM", "Salesforce Admin", "HubSpot Admin" → score 72, strength 'medium'
- Everything else: return null

Then create /app/api/cron/filter/route.ts that:
1. Validates CRON_SECRET header
2. Fetches all jobs scraped in the last 48 hours that haven't been classified yet
3. Runs classifyJob() on each
4. Groups signals by company — if a company has 3+ signal jobs, boost their score by 15 points
5. Upserts into the signals table, generating a context string like: "Hiring 3 sales roles this week including VP of Sales and 2 SDRs"
6. Sets week_of to the Monday of the current week
7. Returns summary: { jobsProcessed: N, signalsCreated: N, highIntentCompanies: N }
```

**Done when:** Running the filter endpoint after scraping creates signal records in Supabase with correct scores.

---

### STEP 5 — Enrichment Pipeline

**Cursor prompt:**
```
@BUILDPLAN.md

Create /lib/apollo.ts with functions to call the Apollo.io API:

1. enrichCompany(domain: string) → fetches company data:
   - employee count
   - industry
   - city/country
   Returns updated company fields.

2. findContacts(domain: string, signalType: string) → finds best contacts:
   - For signal_type 'vp_sales' | 'cro': look for C-suite or VP-level titles (CEO, CRO, VP Sales, VP Revenue)
   - For 'revops' | 'crm_admin': look for Operations or RevOps titles
   - For 'sdr_team' | 'ae_team': look for VP Sales or Head of Sales
   - Return top 2 contacts with: first_name, last_name, title, email, linkedin_url, seniority
   
Use Apollo's /v1/mixed_people/search endpoint. POST with JSON body:
{
  api_key: process.env.APOLLO_API_KEY,
  q_organization_domains: [domain],
  person_titles: [...titles based on signalType],
  per_page: 2
}

Handle rate limits: if Apollo returns 429, wait 2 seconds and retry once.

Then create /app/api/cron/enrich/route.ts that:
1. Validates CRON_SECRET
2. Fetches signals created in the last 48 hours that have no contacts yet
3. For each signal's company: calls enrichCompany() and findContacts()
4. Updates the companies table with fresh data
5. Inserts contacts into the contacts table
6. Returns summary: { companiesEnriched: N, contactsFound: N }
```

**Done when:** Running the enrich endpoint adds contact records to Supabase for each signal company.

---

### STEP 6 — Auth with Clerk

**Cursor prompt:**
```
@BUILDPLAN.md

Set up Clerk authentication:

1. Wrap the app in ClerkProvider in /app/layout.tsx
2. Create /app/(auth)/sign-in/page.tsx using Clerk's <SignIn /> component, centered on page
3. Create /app/(auth)/sign-up/page.tsx using Clerk's <SignUp /> component, centered on page
4. Add middleware.ts at the root that protects all routes under / (dashboard) and leaves /sign-in and /sign-up public
5. Create an API route /app/api/auth/sync/route.ts that:
   - Is called after sign-up (via Clerk webhook or afterSignUp redirect)
   - Creates a subscriber record in Supabase with clerk_user_id, email, plan: 'trial', trial_ends_at: 14 days from now

Style the auth pages minimally — centered card, white background, no distractions.
```

**Done when:** Users can sign up, sign in, and are redirected to dashboard. Signing up creates a subscriber row in Supabase.

---

### STEP 7 — Stripe Billing

**Cursor prompt:**
```
@BUILDPLAN.md

Set up Stripe subscriptions:

1. Create /app/api/stripe/checkout/route.ts (POST):
   - Gets the current Clerk user
   - Creates a Stripe checkout session for the STRIPE_PRICE_ID ($299/mo)
   - Sets success_url and cancel_url
   - Returns the checkout URL

2. Create /app/api/webhooks/stripe/route.ts (POST):
   - Validates the Stripe webhook signature using STRIPE_WEBHOOK_SECRET
   - Handles these events:
     * checkout.session.completed → update subscriber: plan='active', stripe_customer_id, stripe_subscription_id
     * customer.subscription.deleted → update subscriber: plan='cancelled'
     * invoice.payment_failed → log it (handle later)
   - Returns 200 to Stripe

3. Create a middleware check: if a user's plan is not 'active' AND trial has expired, redirect to /upgrade

4. Create /app/upgrade/page.tsx — simple page that says "Your trial has ended" with a "Subscribe for $299/mo" button that calls the checkout API

Use raw body for webhook parsing (required by Stripe).
```

**Done when:** A user can click subscribe, complete Stripe checkout, and their Supabase subscriber record updates to plan='active'.

---

### STEP 8 — The Dashboard

**Cursor prompt:**
```
@BUILDPLAN.md

Build the main dashboard at /app/(dashboard)/page.tsx:

1. Fetch signals from Supabase joined with companies and contacts, ordered by score desc, limited to current week
2. Display as a clean table with columns:
   - Company name + size badge
   - Signal (e.g. "Hiring VP Sales + 2 SDRs")
   - Intent score (color coded: 90+ = green, 70-89 = amber, <70 = gray)
   - Contact (name + title + email, click to copy email)
   - Funding (stage + amount if available)
   - Detected (days ago)

3. Add filter bar above the table:
   - Signal type dropdown (All / VP Sales / RevOps / SDR Team / CRO)
   - Score filter (All / High Intent 80+ / Medium 60-79)
   - Search by company name

4. Create /components/ExportButton.tsx — downloads current filtered signals as CSV with columns: Company, Domain, Signal, Score, Contact Name, Contact Title, Email, Funding, Detected

5. Create /app/(dashboard)/signal/[id]/page.tsx — detail view for a single signal showing:
   - Full company info
   - All signal jobs that triggered it
   - All contacts found
   - Suggested outreach angle (generate with a simple template based on signal_type)

Use Tailwind for all styling. Keep it clean and minimal — this is a tool, not a marketing page.
```

**Done when:** Dashboard loads real signals from Supabase, filters work, CSV export works.

---

### STEP 9 — Weekly Email Digest

**Cursor prompt:**
```
@BUILDPLAN.md

Build the weekly email digest system:

1. Create /lib/email.ts with a sendWeeklyDigest(subscriberEmail: string, signals: Signal[]) function:
   - Uses Resend to send an email
   - Subject: "🔥 {N} hiring signals this week — {top company} is building fast"
   - Email body (plain but clean HTML):
     * Header: "Your HireSignal weekly briefing"
     * Top 10 signals this week, each showing:
       - Company name (bold) + INTENT SCORE badge
       - Signal description (e.g. "Hiring VP of Sales + 2 SDRs")
       - Best contact: Name · Title · Email
       - Funding info if available
     * CTA button: "See all {N} signals →" linking to dashboard
   - From: digest@hiresignal.com (or your Resend domain)

2. Create /app/api/cron/digest/route.ts (POST):
   - Validates CRON_SECRET
   - Fetches all active subscribers from Supabase
   - Fetches top 10 signals from this week (score desc)
   - Sends digest to each subscriber using sendWeeklyDigest()
   - Marks signals as is_new = false after sending
   - Returns: { subscribersEmailed: N }

3. Add to package.json scripts:
   "digest:test": "curl -X POST http://localhost:3000/api/cron/digest -H 'x-cron-secret: your-secret'"
```

**Done when:** Running the test script sends a real email to your own inbox with formatted signals.

---

### STEP 10 — Cron Scheduling on Railway

**Cursor prompt:**
```
@BUILDPLAN.md

Set up automated scheduling so the pipeline runs every night without manual triggers:

1. Create railway.toml in the project root:
```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
```

2. Create /scripts/cron-runner.ts — a simple script that runs the full pipeline in sequence:
   - POST /api/cron/scrape (wait for completion)
   - POST /api/cron/filter (wait for completion)
   - POST /api/cron/enrich (wait for completion)
   - Log results of each step
   - On Mondays at 7am also POST /api/cron/digest

3. Add a CRON schedule in Railway (via dashboard UI):
   - Schedule: 0 2 * * * (2am every night)
   - Command: npx ts-node scripts/cron-runner.ts

4. Add a health check route /app/api/health/route.ts that returns:
   { status: 'ok', lastScrape: <timestamp>, signalsThisWeek: N, activeSubscribers: N }

Document the Railway setup steps in a DEPLOY.md file.
```

**Done when:** Railway runs the pipeline automatically every night and you can verify via the health check endpoint.

---

### STEP 11 — Validation CSV (Pre-launch)

**Cursor prompt:**
```
@BUILDPLAN.md

Before we launch, we need to validate demand manually. Create a one-off script /scripts/generate-validation-csv.ts that:

1. Queries Supabase for the top 20 signals by score from this week
2. Joins with companies and contacts
3. Outputs a CSV file called validation-signals.csv with these columns:
   Company, Website, Signal, Jobs Hiring, Intent Score, Contact Name, Contact Title, Email, Funding Stage, Funding Amount, Why They're Buying

4. The "Why They're Buying" column should be auto-generated based on signal_type:
   - vp_sales → "Building or scaling their sales org — evaluating sales tools and CRM"
   - revops → "Operationalizing their revenue team — likely buying RevOps tooling"
   - sdr_team → "Standing up outbound motion — evaluating sales engagement platforms"
   - cro → "Restructuring GTM — actively evaluating full stack sales tooling"

This CSV is what you show to the first 10 SDRs you DM. Not the product — just the output. Ask them: "Would you find this useful? Would you pay for a weekly version of this?"

Add script to package.json: "validate": "ts-node scripts/generate-validation-csv.ts"
```

**Done when:** `npm run validate` generates a clean CSV you can attach to a LinkedIn DM or share as a Google Sheet.

---

### STEP 12 — Launch Checklist

Run through this before your first paying customer:

**Infrastructure**
- [ ] All env vars filled in on Railway
- [ ] Supabase RLS policies set (users can only see their own subscriber data)
- [ ] Stripe webhook endpoint registered and tested
- [ ] Clerk webhook registered for user sync
- [ ] Cron job running and verified via health endpoint
- [ ] Custom domain pointed at Railway deployment

**Product**
- [ ] Sign up → trial → dashboard flow works end to end
- [ ] Stripe checkout → subscription → access granted works
- [ ] CSV export downloads cleanly
- [ ] Email digest arrives in inbox and looks good on mobile
- [ ] Signal detail page loads for every signal type

**Validation**
- [ ] Validation CSV generated with 20 real signals
- [ ] Shared with 10 SDRs and received at least 3 positive responses
- [ ] At least 1 person said "when can I pay for this?"

**Go-to-market**
- [ ] Landing page live (can be a single /app/page.tsx if not logged in)
- [ ] Loom demo recorded (screen only, no face needed)
- [ ] LinkedIn DM template ready
- [ ] 50 target SDRs identified (search LinkedIn: "SDR" at HubSpot, Salesloft, Outreach, Gong, etc.)

---

## Outreach Templates

### LinkedIn DM (first touch)
```
Hey [Name] — I built a tool that tracks which B2B SaaS companies are actively hiring sales roles (SDRs, VP Sales, RevOps) and delivers a weekly list with the right contact attached.

Most sales reps I've talked to spend 1-2 hrs/day finding this manually. This automates it.

Would it be useful if I sent you this week's list? No strings — just want to see if it's actually valuable before I charge for it.
```

### Follow-up (after they say yes)
```
Here's this week's top signals — [attach validation CSV or Google Sheet link]

The 3 I'd prioritise: [Company A], [Company B], [Company C] — all hired VP Sales in the last 2 weeks.

Does this save you time? Working on making this a $299/mo weekly feed. Would that be worth it for you?
```

---

## Revenue Milestones

| Milestone | Customers | MRR | What unlocks it |
|---|---|---|---|
| Validation | 0 | $0 | CSV shared with 10 SDRs, 3 say yes |
| First dollar | 1 | $299 | Stripe live, first card charged |
| Ramen profitable | 4 | $1,196 | Cover your personal costs |
| Product-market fit signal | 10 | $2,990 | Referrals happening organically |
| Quit your job number | 20 | $5,980 | Sustainable solo income |
| Hire first contractor | 50 | $14,950 | Add more signal types, more boards |
| Raise or sell | 100+ | $30K+ | Strategic options open up |

---

*Last updated: build start. Tag this file in every Cursor prompt with @BUILDPLAN.md*
