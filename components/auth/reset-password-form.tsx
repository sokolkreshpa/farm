"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { updatePassword, type AuthFormState } from "@/lib/auth/actions";

export function ResetPasswordForm({ continueHref }: { continueHref: string }) {
  const t = useTranslations("Auth");
  const tErr = useTranslations("Errors");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    updatePassword,
    {},
  );
  const fieldError = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  if (state.success) {
    return (
      <div className="grid gap-4">
        <Alert>
          <CircleCheck aria-hidden />
          <AlertTitle>{t("reset.doneTitle")}</AlertTitle>
          <AlertDescription>{t("reset.doneBody")}</AlertDescription>
        </Alert>
        <Button asChild size="lg" className="h-11 text-base">
          <Link href={continueHref}>{t("reset.continue")}</Link>
        </Button>
      </div>
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
        name="password"
        type="password"
        label={t("reset.newPassword")}
        autoComplete="new-password"
        hint={t("passwordHint")}
        required
        error={fieldError("password")}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("reset.confirmPassword")}
        autoComplete="new-password"
        required
        error={fieldError("confirmPassword")}
      />
      <Button
        type="submit"
        size="lg"
        className="h-11 text-base"
        disabled={pending}
      >
        {t("reset.submit")}
      </Button>
    </form>
  );
}
