# HireSignal Deployment on Railway

This project deploys cleanly to Railway as a standard Next.js 14 app, with nightly cron execution for the scrape -> filter -> enrich pipeline and a Monday digest send.

## 1. Connect the repo to Railway

1. Push the project to GitHub.
2. In Railway, click `New Project`.
3. Choose `Deploy from GitHub repo`.
4. Select the HireSignal repository.
5. Let Railway create the service from the repo root.
6. Railway will detect the app and use `railway.toml`:

```toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
restartPolicyType = "on_failure"
```

## 2. Set the required environment variables

Add these in Railway under the service `Variables` tab.

### Core app

- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`

### Supabase

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

### Clerk

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

### Contact enrichment

- `APOLLO_API_KEY`
- `HUNTER_API_KEY`

### Email digest

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Optional billing

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_PRICE_ID`

## 3. Set `NEXT_PUBLIC_APP_URL` to production

In development this is `http://localhost:3000`.

In Railway, set it to your live app URL, for example:

```bash
NEXT_PUBLIC_APP_URL=https://your-app.up.railway.app
```

This value is used by:

- the weekly digest links in `app/api/cron/digest/route.ts`
- the sequential cron runner in `scripts/cron-runner.ts`

If you later add a custom domain, update `NEXT_PUBLIC_APP_URL` to that production domain and redeploy.

## 4. Playwright on Railway

HireSignal uses:

- Greenhouse public API for Greenhouse boards
- Playwright only for Lever scraping

That means Playwright must be able to launch Chromium in production.

Recommended setup:

1. Start with the default Railway Nixpacks deploy from this repo.
2. Set:

```bash
PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
```

3. Deploy once and test the scrape cron.

On newer Railway Nixpacks builds, Chromium support may be installed automatically. If the Lever scraper logs show browser-missing or shared-library errors, use Railway's Playwright container guide as the fallback path and switch the service to a Docker-based Playwright image.

Practical rule:

- If Lever scraping works after first deploy, keep the Nixpacks setup.
- If Lever scraping fails with missing browser dependencies, move to Railway's official Playwright deployment guide and use their Playwright-ready container image.

## 5. Create the nightly cron in Railway

This project includes `scripts/cron-runner.ts`, which runs:

1. `POST /api/cron/scrape`
2. `POST /api/cron/filter`
3. `POST /api/cron/enrich`
4. `POST /api/cron/digest` only when the UTC day is Monday

The script reads:

- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`

Add this Railway cron job:

- Schedule: `0 2 * * *`
- Command: `npx ts-node scripts/cron-runner.ts`

Notes:

- Railway cron schedules are UTC.
- The Monday digest check in `scripts/cron-runner.ts` also uses UTC so the behavior matches Railway scheduling.
- The job runs each step sequentially and exits non-zero if any step fails.

## 6. Verify deployment is working

After the first deploy:

1. Open the Railway service logs and confirm the Next.js app booted successfully.
2. Visit the deployed app URL and verify the dashboard loads.
3. In Railway, run the cron command manually once:

```bash
npx ts-node scripts/cron-runner.ts
```

4. Confirm the logs show:
   - `Starting scrape`
   - `Finished scrape`
   - `Finished filter`
   - `Finished enrich`
   - `Finished digest` on Monday UTC, or `Skipping digest` on other days
5. Check Supabase:
   - new or refreshed rows in `jobs`
   - new signals in `signals`
   - new contacts in `contacts`
6. If it is Monday UTC and you have active or trial subscribers, verify the digest email arrives.

## 7. Troubleshooting

### `401 Unauthorized` on cron routes

`CRON_SECRET` in Railway does not match the one the cron runner is sending.

Fix:

- verify the Railway variable is set
- make sure there are no leading or trailing spaces

### Lever scraper fails but Greenhouse works

This usually means Playwright or Chromium is not available in the deployed runtime.

Fix:

- set `PLAYWRIGHT_BROWSERS_PATH=/ms-playwright`
- redeploy
- if it still fails, move the service to Railway's Playwright-ready Docker setup

### Digest links point to localhost

`NEXT_PUBLIC_APP_URL` is still set to a local URL.

Fix:

- update `NEXT_PUBLIC_APP_URL` in Railway to the real production domain
- redeploy

### Cron runs but nothing happens

Check the cron runner logs for the JSON payload returned by each step. The runner logs the timestamp, HTTP status, duration, and response body for every cron endpoint.

## 8. Local smoke test before Railway

You can test the same sequence locally with:

```bash
npm run cron:run
```

Make sure `.env.local` contains valid values for:

- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`

For local testing, `NEXT_PUBLIC_APP_URL` should usually be:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
