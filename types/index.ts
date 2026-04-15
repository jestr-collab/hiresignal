/** Row shape for `companies` (Supabase). */
export interface Company {
  id: string;
  name: string;
  domain: string;
  greenhouse_url: string | null;
  lever_url: string | null;
  size_range: string | null;
  funding_stage: string | null;
  funding_amount: string | null;
  funding_date: string | null;
  linkedin_url: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Row shape for `jobs` (Supabase). */
export interface Job {
  id: string;
  company_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  job_url: string | null;
  board: string | null;
  posted_date: string | null;
  scraped_at: string | null;
  is_active: boolean | null;
}

/** Raw job row returned by board scrapers (before DB insert). */
export interface ScrapedBoardJob {
  title: string;
  job_url: string;
  location: string | null;
  board: "greenhouse" | "lever";
  posted_date: string;
}

/** @deprecated Use ScrapedBoardJob */
export type ScrapedGreenhouseJob = ScrapedBoardJob;

export type ConfidenceLevel = "very_high" | "high" | "medium";

/** Row shape for `signals` (Supabase). */
export interface Signal {
  id: string;
  company_id: string | null;
  signal_type: string;
  signal_strength: string | null;
  score: number | null;
  job_count: number | null;
  job_ids: string[] | null;
  context: string | null;
  why_it_matters: string | null;
  enterprise_flag: boolean | null;
  confidence_level: ConfidenceLevel | null;
  detected_at: string | null;
  is_new: boolean | null;
  week_of: string | null;
}

/** Row shape for `contacts` (Supabase). */
export interface Contact {
  id: string;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  seniority: string | null;
  source: string | null;
  enriched_at: string | null;
}

/** Row shape for `subscribers` (Supabase). */
export interface Subscriber {
  id: string;
  clerk_user_id: string;
  email: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string | null;
  trial_ends_at: string | null;
  created_at: string | null;
}
