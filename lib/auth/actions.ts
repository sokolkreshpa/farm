"use server";

import { getLocale } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { homePathForRole, safeNextPath } from "@/lib/auth/redirect";
import { publicEnv } from "@/lib/env";
import type { ErrorKey } from "@/lib/i18n/errors";
import { createClient } from "@/lib/supabase/server";
import {
  fieldErrors,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type FieldErrors,
} from "@/lib/validation/auth";

export type AuthFormState = {
  error?: ErrorKey;
  fields?: FieldErrors;
  success?: boolean;
  /** Submitted non-secret values, to refill the form after an error. */
  values?: Record<string, string>;
};

function pick(formData: FormData, keys: string[]): Record<string, string> {
  return Object.fromEntries(
    keys.map((k) => [k, String(formData.get(k) ?? "")]),
  );
}

async function absoluteUrl(path: string): Promise<string> {
  const locale = await getLocale();
  return new URL(
    getPathname({ href: path, locale }),
    publicEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = pick(formData, ["email"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error || !data.user) {
    return {
      error:
        error?.code === "email_not_confirmed"
          ? "emailNotConfirmed"
          : "invalidCredentials",
      values,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  const target =
    safeNextPath(parsed.data.next) ??
    homePathForRole(profile?.role ?? "CUSTOMER");
  return redirect({ href: target, locale: await getLocale() });
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = pick(formData, ["firstName", "lastName", "phone", "email"]);
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };
  const { firstName, lastName, phone, email, password, farm, next } =
    parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // The confirmation link returns the customer to where they were (e.g. checkout).
      emailRedirectTo: await absoluteUrl(safeNextPath(next) ?? "/"),
      data: {
        first_name: firstName,
        last_name: lastName,
        phone,
        preferred_locale: await getLocale(),
        privacy_accepted: true,
        ...(farm ? { tenant_slug: farm } : {}),
      },
    },
  });

  if (error) {
    if (error.code === "weak_password") {
      return { fields: { password: "passwordTooWeak" }, values };
    }
    if (error.code === "over_email_send_rate_limit") {
      return { error: "rateLimited", values };
    }
    // Includes "user already exists": answer the same way to avoid account enumeration.
    if (error.code !== "user_already_exists") {
      return { error: "generic", values };
    }
  }
  return { success: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect({ href: "/", locale: await getLocale() });
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = pick(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: await absoluteUrl("/reset-password") },
  );
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "rateLimited", values };
  }
  // Always report success: do not reveal whether the e-mail is registered.
  return { success: true };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fields: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { error: "resetLinkExpired" };

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return error.code === "same_password"
      ? { fields: { password: "passwordSameAsOld" } }
      : { error: "generic" };
  }
  return { success: true };
}
