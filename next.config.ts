import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const supabaseUrlValue =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseUrl = supabaseUrlValue ? new URL(supabaseUrlValue) : null;

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    // Framing, plugins and form targets locked down. script-src is not
    // restricted yet (needs per-request nonces for Next.js inline scripts).
    key: "Content-Security-Policy",
    value:
      "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // Product photos (max 4 MB) are uploaded through a Server Action. Vercel
    // functions accept at most 4.5 MB request bodies.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  images: {
    // Product photos come from Supabase Storage (public bucket).
    remotePatterns: supabaseUrl
      ? [
          {
            protocol: supabaseUrl.protocol.replace(":", "") as "http" | "https",
            hostname: supabaseUrl.hostname,
            port: supabaseUrl.port,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
    // Local Supabase runs on 127.0.0.1, which next/image blocks by default
    // (SSRF protection). Only relaxed when Supabase itself is local.
    dangerouslyAllowLocalIP:
      supabaseUrl !== null &&
      ["127.0.0.1", "localhost"].includes(supabaseUrl.hostname),
  },
};

export default withNextIntl(nextConfig);
