import { writeFileSync } from "fs";
import { chromium } from "playwright";

const DEBUG_URL = "https://boards.greenhouse.io/intercom";
const HTML_OUT = "/tmp/greenhouse-debug.html";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto(DEBUG_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    const title = await page.title();
    const html = await page.content();
    writeFileSync(HTML_OUT, html, "utf-8");

    const anchorCount = await page.locator("a").count();

    const jobHrefs = await page.evaluate(() => {
      const out: string[] = [];
      const seen = new Set<string>();
      for (const a of Array.from(document.querySelectorAll("a[href]"))) {
        const href = a.getAttribute("href")?.trim() ?? "";
        if (!href.toLowerCase().includes("job")) continue;
        if (seen.has(href)) continue;
        seen.add(href);
        out.push(href);
      }
      return out.sort();
    });

    const bodyTextPreview = await page.evaluate(() => {
      const body = document.body;
      if (!body) return "";
      const t = body.innerText ?? "";
      return t.slice(0, 2000).replace(/\s+/g, " ").trim();
    });

    console.log("=== Greenhouse debug scrape ===");
    console.log("URL:", DEBUG_URL);
    console.log("");
    console.log("--- Page title ---");
    console.log(title);
    console.log("");
    console.log("--- Full HTML ---");
    console.log(`Written to ${HTML_OUT} (${html.length} bytes)`);
    console.log("");
    console.log("--- <a> tag count (all) ---");
    console.log(anchorCount);
    console.log("");
    console.log('--- href values containing "job" (case-insensitive) ---');
    console.log(`Count: ${jobHrefs.length}`);
    for (const h of jobHrefs) {
      console.log(h);
    }
    console.log("");
    console.log("--- First 2000 chars of body text ---");
    console.log(bodyTextPreview);
    console.log("");
    console.log("=== Done ===");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
