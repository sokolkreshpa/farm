import { toErrorKey, type ErrorKey } from "@/lib/i18n/errors";

/**
 * Maps a Supabase/PostgREST error to a translatable key. Business functions
 * raise stable codes in MESSAGE (D-45); constraint violations map to generic
 * keys.
 */
export function dbErrorKey(
  error: { code?: string; message?: string } | null | undefined,
): ErrorKey {
  if (!error) return "generic";
  switch (error.code) {
    case "23505":
      return "DUPLICATE";
    case "23503":
      return "IN_USE";
    case "42501":
      return "FORBIDDEN";
    default:
      return toErrorKey(error.message);
  }
}
