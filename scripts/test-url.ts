async function headOk(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(targetUrl, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "user-agent": "HireSignal-test-url/1.0",
      },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function main() {
  const url = process.argv[2]?.trim();
  if (!url) {
    console.error("Usage: npm run test-url -- <url>");
    process.exit(1);
  }

  const ok = await headOk(url);
  if (ok) {
    console.log("✓ Valid — safe to add to Supabase");
    return;
  }

  console.log("✗ Dead — do not add");
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
