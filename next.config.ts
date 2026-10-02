import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
  : null;

const nextConfig: NextConfig = {
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
