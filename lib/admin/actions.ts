"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getPathname, redirect } from "@/i18n/navigation";
import { requirePlatformAdmin } from "@/lib/dal/session";
import { publicEnv } from "@/lib/env";
import type { ErrorKey } from "@/lib/i18n/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { newFarmSchema } from "@/lib/validation/farm";

export type AdminFormState = { error?: ErrorKey; fields?: FieldErrors };

/**
 * Creates a farm and invites its farmer by e-mail (D-38). Uses the secret key
 * (bypasses RLS) — only after requirePlatformAdmin().
 */
export async function createFarm(
  _prev: AdminFormState,
  formData: FormData,
): Promise<AdminFormState> {
  await requirePlatformAdmin();
  const parsed = newFarmSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };
  const f = parsed.data;

  const admin = createAdminClient();

  // Check the address first so we don't send an invite for a farm that
  // can't be created.
  const { data: taken } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", f.slug)
    .maybeSingle();
  if (taken) return { fields: { slug: "slugTaken" } };

  // Invite a new user, or reuse an existing account with that e-mail.
  const locale = await getLocale();
  let profileId: string | null = null;
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(f.farmerEmail, {
      data: {
        first_name: f.farmerFirstName,
        last_name: f.farmerLastName,
        preferred_locale: locale,
      },
      redirectTo: new URL(
        getPathname({ href: "/reset-password", locale }),
        publicEnv.NEXT_PUBLIC_SITE_URL,
      ).toString(),
    });
  if (invited?.user) {
    profileId = invited.user.id;
  } else if (inviteError?.code === "email_exists") {
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", f.farmerEmail)
      .maybeSingle();
    profileId = existing?.id ?? null;
  }
  if (!profileId) return { error: "inviteFailed" };

  // Tenant + FARMER role + membership in one transaction; refuses to turn a
  // platform admin into a farmer (D-74).
  const { error } = await admin.rpc("create_farm_with_owner", {
    p_name: f.name,
    p_slug: f.slug,
    p_phone: f.phone ?? "",
    p_email: f.email ?? "",
    p_owner_id: profileId,
  });
  if (error) {
    if (error.code === "23505") return { fields: { slug: "slugTaken" } };
    if (error.message === "OWNER_IS_ADMIN")
      return { fields: { farmerEmail: "ownerIsAdmin" } };
    return { error: "generic" };
  }

  revalidatePath("/admin");
  return redirect({ href: "/admin", locale });
}

export async function setFarmActive(
  tenantId: string,
  active: boolean,
): Promise<void> {
  await requirePlatformAdmin();
  z.boolean().parse(active);
  const admin = createAdminClient();
  await admin
    .from("tenants")
    .update({ active })
    .eq("id", z.uuid().parse(tenantId));
  revalidatePath("/admin");
}
