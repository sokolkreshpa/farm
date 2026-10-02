"use client";

import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { addWeekItem, type FarmFormState } from "@/lib/farm/actions";
import type { CatalogueProduct } from "@/lib/farm/queries";
import { toDecimalInput } from "@/lib/format";

type AddWeekItemProps = {
  cycleId: string;
  products: CatalogueProduct[];
  currencyLabel: string;
};

export function AddWeekItem({
  cycleId,
  products,
  currencyLabel,
}: AddWeekItemProps) {
  const t = useTranslations("Week");
  const [state, action, pending] = useActionState<FarmFormState, FormData>(
    addWeekItem,
    {},
  );

  if (products.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("allAdded")}{" "}
        <Link
          href="/farm/products/new"
          className="text-primary underline-offset-4 hover:underline"
        >
          {t("newProduct")}
        </Link>
      </p>
    );
  }

  // Remounts after each successful add, which resets the selection.
  return (
    <AddWeekItemForm
      key={state.nonce ?? "initial"}
      cycleId={cycleId}
      products={products}
      currencyLabel={currencyLabel}
      action={action}
      pending={pending}
      state={state}
    />
  );
}

function AddWeekItemForm({
  cycleId,
  products,
  currencyLabel,
  action,
  pending,
  state,
}: AddWeekItemProps & {
  action: (formData: FormData) => void;
  pending: boolean;
  state: FarmFormState;
}) {
  const t = useTranslations("Week");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const unit = useUnitLabel();
  const [productId, setProductId] = useState("");
  const selected = products.find((p) => p.id === productId);
  const fieldError =
    state.fields?.productId ??
    state.fields?.price ??
    state.fields?.availableQuantity;

  return (
    <form
      action={action}
      className="grid gap-3 rounded-2xl border border-dashed border-border p-3 sm:p-4"
    >
      <p className="font-medium">{t("addProduct")}</p>
      <input type="hidden" name="cycleId" value={cycleId} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label
            htmlFor="add-product"
            className="text-xs text-muted-foreground"
          >
            {t("product")}
          </Label>
          <select
            id="add-product"
            name="productId"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="h-11 min-w-48 rounded-lg border border-input bg-background px-3 text-base"
          >
            <option value="">{t("chooseProduct")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({unit(p.unitCode)})
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <Label
            htmlFor="add-quantity"
            className="text-xs text-muted-foreground"
          >
            {t("available")}
          </Label>
          <Input
            id="add-quantity"
            name="availableQuantity"
            inputMode="decimal"
            key={`q-${productId}`}
            defaultValue={toDecimalInput(
              selected?.lastQuantity ?? null,
              locale,
            )}
            className="h-11 w-24 text-right text-base"
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="add-price" className="text-xs text-muted-foreground">
            {t("price")} ({currencyLabel})
          </Label>
          <Input
            id="add-price"
            name="price"
            inputMode="decimal"
            key={`p-${productId}`}
            defaultValue={toDecimalInput(selected?.lastPrice ?? null, locale)}
            className="h-11 w-28 text-right text-base"
          />
        </div>
        <Button
          type="submit"
          size="lg"
          className="h-11"
          disabled={pending || !productId}
        >
          {t("add")}
        </Button>
      </div>
      {(fieldError || state.error) && (
        <p role="alert" className="text-sm text-destructive">
          {tErr(fieldError ?? state.error!)}
        </p>
      )}
    </form>
  );
}
