import { z } from "zod";
import { toErrorKey, type ErrorKey } from "@/lib/i18n/errors";

// Error messages are translation keys under the "Errors" namespace.

const email = z.string().trim().toLowerCase().pipe(z.email("emailInvalid"));

// Matches supabase/config.toml: min 8 chars, letters and digits.
export const passwordSchema = z
  .string()
  .min(8, "passwordTooShort")
  .max(72, "passwordTooLong")
  .regex(/[A-Za-z]/, "passwordNeedsLetter")
  .regex(/\d/, "passwordNeedsDigit");

const phone = z
  .string()
  .trim()
  .min(6, "phoneInvalid")
  .max(30, "phoneInvalid")
  .regex(/^[+\d][\d\s-]*$/, "phoneInvalid");

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(50);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "required"),
  next: z.string().optional(),
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(80, "tooLong"),
  lastName: z.string().trim().min(1, "required").max(80, "tooLong"),
  phone,
  email,
  password: passwordSchema,
  privacyAccepted: z.literal("on", { error: "privacyRequired" }),
  farm: slug.optional().or(z.literal("").transform(() => undefined)),
  next: z.string().optional(),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "passwordsDontMatch",
    path: ["confirmPassword"],
  });

export type FieldErrors = Partial<Record<string, ErrorKey>>;

/** First error key per field, for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= toErrorKey(issue.message);
  }
  return out;
}
