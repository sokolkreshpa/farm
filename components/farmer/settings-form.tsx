"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateFarmSettings, type FarmFormState } from "@/lib/farm/actions";
import type { FarmSettings } from "@/lib/farm/queries";
import { currencyLabel, toDecimalInput } from "@/lib/format";

export function SettingsForm({ settings }: { settings: FarmSettings }) {
  const t = useTranslations("FarmSettings");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const [state, action, pending] = useActionState<FarmFormState, FormData>(
    updateFarmSettings,
    {},
  );
  const err = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  const textarea = (
    name: string,
    label: string,
    value: string | null,
    max: number,
  ) => (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        defaultValue={value ?? ""}
        maxLength={max}
      />
    </div>
  );

  return (
    <form action={action} className="grid gap-8" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(state.error)}</AlertDescription>
        </Alert>
      )}
      <section className="grid gap-4">
        <h2 className="font-heading text-xl font-semibold">{t("farm")}</h2>
        <FormField
          name="name"
          label={t("name")}
          defaultValue={settings.name}
          error={err("name")}
        />
        {textarea("description", t("description"), settings.description, 2000)}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="phone"
            type="tel"
            label={t("phone")}
            defaultValue={settings.phone ?? ""}
            error={err("phone")}
          />
          <FormField
            name="email"
            type="email"
            label={t("email")}
            defaultValue={settings.email ?? ""}
            error={err("email")}
          />
        </div>
        <FormField
          name="address"
          label={t("address")}
          defaultValue={settings.address ?? ""}
          error={err("address")}
        />
      </section>

      <section className="grid gap-4">
        <h2 className="font-heading text-xl font-semibold">{t("ordering")}</h2>
        <Label className="flex items-center gap-3 font-normal">
          <Checkbox
            name="deliveryEnabled"
            defaultChecked={settings.deliveryEnabled}
            className="size-5"
          />
          {t("deliveryEnabled")}
        </Label>
        <FormField
          name="deliveryFee"
          inputMode="decimal"
          label={`${t("deliveryFee")} (${currencyLabel(settings.currency, locale)})`}
          defaultValue={toDecimalInput(settings.deliveryFee, locale)}
          error={err("deliveryFee")}
          className="h-11 max-w-40 text-base"
        />
        {textarea(
          "deliveryInformation",
          t("deliveryInformation"),
          settings.deliveryInformation,
          2000,
        )}
        <Label className="flex items-center gap-3 font-normal">
          <Checkbox
            name="pickupEnabled"
            defaultChecked={settings.pickupEnabled}
            className="size-5"
          />
          {t("pickupEnabled")}
        </Label>
        {err("pickupEnabled") && (
          <p className="text-sm text-destructive">{err("pickupEnabled")}</p>
        )}
        {textarea(
          "pickupInformation",
          t("pickupInformation"),
          settings.pickupInformation,
          1000,
        )}
        <Label className="flex items-center gap-3 font-normal">
          <Checkbox
            name="enforceInventory"
            defaultChecked={settings.enforceInventory}
            className="size-5"
          />
          {t("enforceInventory")}
        </Label>
      </section>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="h-12 text-base"
          disabled={pending}
        >
          {t("save")}
        </Button>
        {state.success && (
          <span role="status" className="text-sm text-primary">
            {t("saved")}
          </span>
        )}
      </div>
    </form>
  );
}
