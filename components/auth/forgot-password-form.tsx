"use client";

import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requestPasswordReset, type AuthFormState } from "@/lib/auth/actions";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const tErr = useTranslations("Errors");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    requestPasswordReset,
    {},
  );

  if (state.success) {
    return (
      <Alert>
        <MailCheck aria-hidden />
        <AlertTitle>{t("forgot.sentTitle")}</AlertTitle>
        <AlertDescription>{t("forgot.sentBody")}</AlertDescription>
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
      <FormField
        name="email"
        defaultValue={state.values?.email}
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        error={state.fields?.email ? tErr(state.fields.email) : undefined}
      />
      <Button
        type="submit"
        size="lg"
        className="h-11 text-base"
        disabled={pending}
      >
        {t("forgot.submit")}
      </Button>
    </form>
  );
}
