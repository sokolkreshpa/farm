import type { Database } from "@/types/database";

type Role = Database["public"]["Enums"]["app_role"];

/**
 * Returns `value` only if it is a same-site relative path ("/f/x/checkout").
 * Blocks open redirects such as "//evil.com", "/\evil.com" or "https://…".
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || /[\u0000-\u001f]/.test(value)) return null;
  return value;
}

/**
 * Accepts either a relative path or an absolute URL on our own site
 * (Supabase e-mail links pass the full redirect URL), returning a safe path.
 */
export function safeRedirectTarget(
  value: string | null | undefined,
  siteUrl: string,
): string | null {
  if (!value) return null;
  if (value.startsWith("/")) return safeNextPath(value);
  try {
    const url = new URL(value);
    if (url.origin !== new URL(siteUrl).origin) return null;
    return safeNextPath(url.pathname + url.search);
  } catch {
    return null;
  }
}

/** Where to send a user after login when no `next` is given. */
export function homePathForRole(role: Role): string {
  switch (role) {
    case "FARMER":
      return "/farm";
    case "PLATFORM_ADMIN":
      return "/admin";
    default:
      return "/";
  }
}
