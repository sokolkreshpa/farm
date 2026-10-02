"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/dal/session";
import type { ErrorKey } from "@/lib/i18n/errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { addressSchema } from "@/lib/validation/order";

export type AccountFormState = {
  error?: ErrorKey;
  fields?: FieldErrors;
  success?: boolean;
};

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(80, "tooLong"),
  lastName: z.string().trim().max(80, "tooLong"),
  phone: z
    .string()
    .trim()
    .max(30, "phoneInvalid")
    .regex(/^([+\d][\d\s-]*)?$/, "phoneInvalid"),
  preferredLocale: z.enum(["sq", "en"]),
});

export async function updateProfile(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const viewer = await requireViewer("/account");
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone || null,
      preferred_locale: parsed.data.preferredLocale,
    })
    .eq("id", viewer.id);
  if (error) return { error: "generic" };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function addAddress(
  _prev: AccountFormState,
  formData: FormData,
): Promise<AccountFormState> {
  const viewer = await requireViewer("/account");
  const parsed = addressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { count } = await supabase
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", viewer.id);

  const { error } = await supabase.from("addresses").insert({
    profile_id: viewer.id,
    label: parsed.data.label ?? null,
    address_line: parsed.data.addressLine,
    city: parsed.data.city,
    notes: parsed.data.notes ?? null,
    is_default: !count,
  });
  if (error) return { error: "generic" };

  revalidatePath("/account");
  return { success: true };
}

const idSchema = z.uuid();

export async function deleteAddress(addressId: string): Promise<void> {
  const viewer = await requireViewer("/account");
  const id = idSchema.parse(addressId);
  const supabase = await createClient();
  // RLS limits this to the viewer's own addresses; the filter is defence in depth.
  await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("profile_id", viewer.id);
  revalidatePath("/account");
}

export async function setDefaultAddress(addressId: string): Promise<void> {
  const viewer = await requireViewer("/account");
  const id = idSchema.parse(addressId);
  const supabase = await createClient();
  await supabase
    .from("addresses")
    .update({ is_default: false })
    .eq("profile_id", viewer.id)
    .eq("is_default", true);
  await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", id)
    .eq("profile_id", viewer.id);
  revalidatePath("/account");
}

export async function requestAccountDeletion(): Promise<void> {
  const viewer = await requireViewer("/account");
  const supabase = await createClient();
  await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("id", viewer.id);
  revalidatePath("/account");
}
