"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { ProductImage } from "@/components/products/product-image";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveProduct, type FarmFormState } from "@/lib/farm/actions";
import type { FarmProduct, Unit } from "@/lib/farm/queries";
import { toDecimalInput } from "@/lib/format";

type ProductFormProps = { product?: FarmProduct; units: Unit[] };

export function ProductForm({ product, units }: ProductFormProps) {
  const t = useTranslations("FarmProducts");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const unitLabel = useUnitLabel();
  const [state, action, pending] = useActionState<FarmFormState, FormData>(
    saveProduct,
    {},
  );
  const [unitCode, setUnitCode] = useState(
    product?.unitCode ?? units[0]?.code ?? "kg",
  );
  const [step, setStep] = useState(
    toDecimalInput(
      product?.quantityStep ??
        units.find((u) => u.code === unitCode)?.defaultStep ??
        1,
      locale,
    ),
  );
  const [preview, setPreview] = useState<string | null>(
    product?.imageUrl ?? null,
  );
  const err = (name: string) =>
    state.fields?.[name] ? tErr(state.fields[name]) : undefined;

  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(state.error)}</AlertDescription>
        </Alert>
      )}
      <input type="hidden" name="id" value={product?.id ?? ""} />
      <FormField
        name="name"
        label={t("name")}
        defaultValue={product?.name}
        required
        error={err("name")}
      />
      <div className="grid gap-2">
        <Label htmlFor="description">{t("description")}</Label>
        <Textarea
          id="description"
          name="description"
          defaultValue={product?.description ?? ""}
          maxLength={1000}
        />
      </div>
      <FormField
        name="category"
        label={t("category")}
        placeholder={t("categoryPlaceholder")}
        defaultValue={product?.category ?? ""}
        error={err("category")}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="unitCode">{t("unit")}</Label>
          <select
            id="unitCode"
            name="unitCode"
            value={unitCode}
            onChange={(e) => {
              setUnitCode(e.target.value);
              const unit = units.find((u) => u.code === e.target.value);
              if (unit) setStep(toDecimalInput(unit.defaultStep, locale));
            }}
            className="h-11 rounded-lg border border-input bg-background px-3 text-base"
          >
            {units.map((u) => (
              <option key={u.code} value={u.code}>
                {unitLabel(u.code)}
              </option>
            ))}
          </select>
        </div>
        <FormField
          name="quantityStep"
          label={t("step")}
          inputMode="decimal"
          value={step}
          onChange={(e) => setStep(e.target.value)}
          hint={t("stepHint")}
          error={err("quantityStep")}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="image">{t("photo")}</Label>
        <div className="flex items-center gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object-URL preview
            <img
              src={preview}
              alt=""
              className="size-24 rounded-lg object-cover"
            />
          ) : (
            <ProductImage
              name={product?.name ?? "?"}
              imageUrl={null}
              className="size-24"
            />
          )}
          <input
            id="image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setPreview(
                file ? URL.createObjectURL(file) : (product?.imageUrl ?? null),
              );
            }}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm"
          />
        </div>
        <p
          className={
            err("image")
              ? "text-sm text-destructive"
              : "text-sm text-muted-foreground"
          }
        >
          {err("image") ?? t("photoHint")}
        </p>
      </div>

      <Label className="flex items-center gap-3 font-normal">
        <Checkbox
          name="active"
          defaultChecked={product?.active ?? true}
          className="size-5"
        />
        {t("active")}
      </Label>

      <Button
        type="submit"
        size="lg"
        className="h-12 w-fit text-base"
        disabled={pending}
      >
        {t("save")}
      </Button>
    </form>
  );
}
