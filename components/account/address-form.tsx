"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { addAddress, type AccountFormState } from "@/lib/account/actions";

export function AddressForm() {
  const t = useTranslations("Checkout");
  const tPage = useTranslations("AccountPage");
  const tErr = useTranslations("Errors");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    addAddress,
    {},
  );
  const err = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="grid gap-3 rounded-xl bg-muted/50 p-3"
      noValidate
    >
      <FormField
        name="addressLine"
        label={t("addressLine")}
        autoComplete="street-address"
        error={err("addressLine")}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          name="city"
          label={t("city")}
          autoComplete="address-level2"
          error={err("city")}
        />
        <FormField
          name="label"
          label={t("addressLabel")}
          error={err("label")}
        />
      </div>
      <FormField name="notes" label={t("addressNotes")} error={err("notes")} />
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="w-fit"
        disabled={pending}
      >
        {tPage("addAddress")}
      </Button>
    </form>
  );
}
