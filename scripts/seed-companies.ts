import { config } from "dotenv";
import { readFileSync } from "fs";
import { resolve } from "path";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey);

type CsvRow = {
  name: string;
  domain: string;
  greenhouse_url: string;
  lever_url: string;
  size_range: string;
};

function emptyToNull(value: string | undefined): string | null {
  const v = value?.trim();
  return !v ? null : v;
}

async function main() {
  const csvPath = resolve(process.cwd(), "companies.csv");
  const raw = readFileSync(csvPath, "utf-8");

  const rows = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  let successCount = 0;

  for (const row of rows) {
    const name = row.name?.trim();
    const domain = row.domain?.trim();
    if (!name || !domain) continue;

    const payload = {
      name,
      domain,
      greenhouse_url: emptyToNull(row.greenhouse_url),
      lever_url: emptyToNull(row.lever_url),
      size_range: emptyToNull(row.size_range),
    };

    const { error } = await supabase
      .from("companies")
      .upsert(payload, { onConflict: "domain" });

    if (error) {
      console.error(`Failed to upsert ${name}:`, error.message);
      process.exit(1);
    }

    console.log(name);
    successCount += 1;
  }

  console.log(`Seeded ${successCount} companies successfully`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
