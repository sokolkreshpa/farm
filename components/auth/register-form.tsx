"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signUp, type AuthFormState } from "@/lib/auth/actions";

type RegisterFormProps = { farm?: string; next?: string };

export function RegisterForm({ farm, next }: RegisterFormProps) {
  const t = useTranslations("Auth");
  const tErr = useTranslations("Errors");
  const [email, setEmail] = useState("");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signUp,
    {},
  );
  const fieldError = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  if (state.success) {
    return (
      <Alert>
        <MailCheck aria-hidden />
        <AlertTitle>{t("register.checkEmailTitle")}</AlertTitle>
        <AlertDescription>
          {t("register.checkEmailBody", { email })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(state.error)}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="farm" value={farm ?? ""} />
      <input type="hidden" name="next" value={next ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="firstName"
          defaultValue={state.values?.firstName}
          label={t("firstName")}
          autoComplete="given-name"
          required
          error={fieldError("firstName")}
        />
        <FormField
          name="lastName"
          defaultValue={state.values?.lastName}
          label={t("lastName")}
          autoComplete="family-name"
          required
          error={fieldError("lastName")}
        />
      </div>
      <FormField
        name="phone"
        defaultValue={state.values?.phone}
        type="tel"
        label={t("phone")}
        autoComplete="tel"
        inputMode="tel"
        hint={t("phoneHint")}
        required
        error={fieldError("phone")}
      />
      <FormField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldError("email")}
      />
      <FormField
        name="password"
        type="password"
        label={t("password")}
        autoComplete="new-password"
        hint={t("passwordHint")}
        required
        error={fieldError("password")}
      />
      <div className="grid gap-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id="privacyAccepted"
            name="privacyAccepted"
            className="mt-0.5 size-5"
            aria-invalid={state.fields?.privacyAccepted ? true : undefined}
          />
          <Label htmlFor="privacyAccepted" className="leading-snug font-normal">
            {t.rich("register.privacy", {
              link: (chunks) => (
                <Link
                  href="/privacy"
                  target="_blank"
                  className="text-primary underline underline-offset-4"
                >
                  {chunks}
                </Link>
              ),
            })}
          </Label>
        </div>
        {fieldError("privacyAccepted") && (
          <p className="text-sm text-destructive">
            {fieldError("privacyAccepted")}
          </p>
        )}
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-11 text-base"
        disabled={pending}
      >
        {t("register.submit")}
      </Button>
    </form>
  );
}
