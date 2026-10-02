import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/types/database";

/**
 * Supabase client with the secret key: BYPASSES RLS.
 * Only for platform-admin actions (after requirePlatformAdmin()) and the
 * notification sender. Never import from client components.
 */
export function createAdminClient() {
  const secretKey = serverEnv().SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("SUPABASE_SECRET_KEY is not configured");

  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
