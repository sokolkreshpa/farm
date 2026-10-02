"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { signIn, type AuthFormState } from "@/lib/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Auth");
  const tErr = useTranslations("Errors");
  const [state, action, pending] = useActionState<AuthFormState, FormData>(
    signIn,
    {},
  );
  const fieldError = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(state.error)}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="next" value={next ?? ""} />
      <FormField
        name="email"
        defaultValue={state.values?.email}
        type="email"
        label={t("email")}
        autoComplete="email"
        inputMode="email"
        required
        error={fieldError("email")}
      />
      <FormField
        name="password"
        type="password"
        label={t("password")}
        autoComplete="current-password"
        required
        error={fieldError("password")}
      />
      <Button
        type="submit"
        size="lg"
        className="h-11 text-base"
        disabled={pending}
      >
        {t("login.submit")}
      </Button>
      <Link
        href="/forgot-password"
        className="text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        {t("login.forgot")}
      </Link>
    </form>
  );
}
