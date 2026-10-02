"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { updateProfile, type AccountFormState } from "@/lib/account/actions";

type ProfileFormProps = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  preferredLocale: "sq" | "en";
};

export function ProfileForm(props: ProfileFormProps) {
  const t = useTranslations("Auth");
  const tPage = useTranslations("AccountPage");
  const tErr = useTranslations("Errors");
  const tLocale = useTranslations("LocaleSwitcher");
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    updateProfile,
    {},
  );
  const err = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="firstName"
          label={t("firstName")}
          defaultValue={props.firstName}
          autoComplete="given-name"
          error={err("firstName")}
        />
        <FormField
          name="lastName"
          label={t("lastName")}
          defaultValue={props.lastName}
          autoComplete="family-name"
          error={err("lastName")}
        />
      </div>
      <FormField
        name="phone"
        type="tel"
        label={t("phone")}
        defaultValue={props.phone}
        autoComplete="tel"
        error={err("phone")}
      />
      <FormField
        name="email"
        label={t("email")}
        defaultValue={props.email}
        disabled
      />
      <div className="grid gap-2">
        <Label htmlFor="preferredLocale">{tPage("language")}</Label>
        <select
          id="preferredLocale"
          name="preferredLocale"
          defaultValue={props.preferredLocale}
          className="h-11 rounded-lg border border-input bg-background px-3 text-base"
        >
          <option value="sq">{tLocale("sq")}</option>
          <option value="en">{tLocale("en")}</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={pending}>
          {tPage("save")}
        </Button>
        {state.success && (
          <span className="text-sm text-primary" role="status">
            {tPage("saved")}
          </span>
        )}
        {state.error && (
          <span className="text-sm text-destructive" role="alert">
            {tErr(state.error)}
          </span>
        )}
      </div>
    </form>
  );
}
