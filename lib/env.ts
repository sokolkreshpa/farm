import { z } from "zod";

// Runtime configuration shared by server code (also used by proxy.ts).
// Accepts the names created by Vercel's Supabase integration as fallbacks,
// and derives the site URL from Vercel's system variables when not set.

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

function vercelSiteUrl(): string | undefined {
  const host =
    process.env.VERCEL_ENV === "production"
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  return host ? `https://${host}` : undefined;
}

const raw = {
  NEXT_PUBLIC_SUPABASE_URL:
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || vercelSiteUrl(),
};

const parsed = publicSchema.safeParse(raw);
if (!parsed.success) {
  const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
  throw new Error(
    `Missing or invalid environment variables: ${missing}. ` +
      "Locally: copy .env.example to .env.local. " +
      "On Vercel: Settings → Environment Variables (for Production and Preview), " +
      "then redeploy — see docs/deployment.md step 5.",
  );
}

export const publicEnv = parsed.data;
