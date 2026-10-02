import "server-only";
import { getLocale } from "next-intl/server";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Role = Database["public"]["Enums"]["app_role"];

export type Viewer = {
  id: string;
  email: string;
  role: Role;
  firstName: string;
  lastName: string;
  phone: string | null;
  preferredLocale: "sq" | "en";
};

export type FarmerContext = {
  viewer: Viewer;
  tenant: { id: string; name: string; slug: string };
};

/** The signed-in user (verified JWT + profile), or null. Cached per request. */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, role, first_name, last_name, phone, preferred_locale")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email,
    role: profile.role,
    firstName: profile.first_name,
    lastName: profile.last_name,
    phone: profile.phone,
    preferredLocale: profile.preferred_locale === "en" ? "en" : "sq",
  };
});

async function redirectToLogin(nextPath?: string): Promise<never> {
  const locale = await getLocale();
  const query = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
  return redirect({ href: `/login${query}`, locale });
}

async function redirectHome(): Promise<never> {
  return redirect({ href: "/", locale: await getLocale() });
}

/** Any signed-in user. Redirects to login (returning to `nextPath`) otherwise. */
export async function requireViewer(nextPath?: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) return redirectToLogin(nextPath);
  return viewer;
}

/**
 * A farmer and the farm they manage. The tenant comes from tenant_members for
 * the signed-in user — never from request input (spec §21).
 */
export const requireFarmer = cache(async (): Promise<FarmerContext> => {
  const viewer = await requireViewer("/farm");
  if (viewer.role !== "FARMER") return redirectHome();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("tenant_members")
    .select("tenants!inner (id, name, slug)")
    .eq("profile_id", viewer.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  // Multi-farm farmers (future): pick by a validated cookie instead of the first.
  if (!membership) return redirectHome();
  return { viewer, tenant: membership.tenants };
});

export async function requirePlatformAdmin(): Promise<Viewer> {
  const viewer = await requireViewer("/admin");
  if (viewer.role !== "PLATFORM_ADMIN") return redirectHome();
  return viewer;
}
