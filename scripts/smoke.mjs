#!/usr/bin/env node
// Post-deployment smoke test: `npm run smoke -- https://your-app.vercel.app [farm-slug]`
// Read-only: checks that the deployment is up, wired to Supabase, localized
// and sending security headers. Exits non-zero on the first failure.

const [base, slug = "ferma-kodra"] = process.argv.slice(2);
if (!base) {
  console.error("Usage: npm run smoke -- <base-url> [farm-slug]");
  process.exit(2);
}
const url = (path) => new URL(path, base).toString();
let failures = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  ✗ ${name}: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log(`Smoke testing ${base}`);

await check("health endpoint responds", async () => {
  const res = await fetch(url("/api/health"));
  assert(res.ok, `status ${res.status}`);
  assert((await res.json()).ok === true, "unexpected body");
});

await check(
  `farm page /f/${slug} renders in Albanian (Supabase reachable)`,
  async () => {
    const res = await fetch(url(`/f/${slug}`));
    assert(
      res.status === 200,
      `status ${res.status} (farm missing or DB unreachable)`,
    );
    const html = await res.text();
    assert(html.includes('lang="sq"'), "html lang is not sq");
    assert(html.includes("Produktet e freskëta"), "shop heading missing");
  },
);

await check("English version is served under /en", async () => {
  const res = await fetch(url(`/en/f/${slug}`));
  assert(res.status === 200, `status ${res.status}`);
  assert((await res.text()).includes('lang="en"'), "html lang is not en");
});

await check("security headers are present", async () => {
  const res = await fetch(url("/login"));
  for (const header of [
    "x-content-type-options",
    "x-frame-options",
    "referrer-policy",
    "strict-transport-security",
    "content-security-policy",
  ]) {
    assert(res.headers.get(header), `missing ${header}`);
  }
  assert(!res.headers.get("x-powered-by"), "x-powered-by should be removed");
});

await check("farmer area requires login", async () => {
  const res = await fetch(url("/farm"), { redirect: "manual" });
  assert([307, 308, 302, 303].includes(res.status), `status ${res.status}`);
  assert(
    (res.headers.get("location") ?? "").includes("/login"),
    "not redirected to login",
  );
});

await check("cron endpoint rejects unauthenticated calls", async () => {
  const res = await fetch(url("/api/cron/notifications"));
  assert(res.status === 401, `status ${res.status}`);
});

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
