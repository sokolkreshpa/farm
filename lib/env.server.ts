import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  // Required only by createAdminClient(); optional so builds work without it.
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
  DEFAULT_TENANT_SLUG: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

let cached: z.infer<typeof serverSchema> | undefined;

// Parsed lazily so builds that never touch server secrets don't require them.
export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY || undefined,
    DEFAULT_TENANT_SLUG: process.env.DEFAULT_TENANT_SLUG || undefined,
    CRON_SECRET: process.env.CRON_SECRET || undefined,
    RESEND_API_KEY: process.env.RESEND_API_KEY || undefined,
    EMAIL_FROM: process.env.EMAIL_FROM || undefined,
  });
  return cached;
}
