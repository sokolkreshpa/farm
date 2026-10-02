"use client";

import { Check, Loader2, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import { removeWeekItem, updateWeekItem } from "@/lib/farm/actions";
import type { EditorItem } from "@/lib/farm/queries";
import { formatQuantity, toDecimalInput } from "@/lib/format";
import type { ErrorKey } from "@/lib/i18n/errors";
import { cn } from "@/lib/utils";

type Field =
  "price" | "availableQuantity" | "minimumQuantity" | "maximumQuantity";

type WeekItemRowProps = {
  item: EditorItem;
  currencyLabel: string;
  readOnly: boolean;
};

/** One product of the week. Fields save on blur (no big form to lose). */
export function WeekItemRow({
  item,
  currencyLabel,
  readOnly,
}: WeekItemRowProps) {
  const t = useTranslations("Week");
  const tErr = useTranslations("Errors");
  const locale = useLocale();
  const unit = useUnitLabel()(item.unitCode);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved">("idle");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [listed, setListed] = useState(item.listed);
  const [values, setValues] = useState<Record<Field, string>>({
    price: toDecimalInput(item.price, locale),
    availableQuantity: toDecimalInput(item.availableQuantity, locale),
    minimumQuantity: toDecimalInput(item.minimumQuantity, locale),
    maximumQuantity: toDecimalInput(item.maximumQuantity, locale),
  });
  const [saved, setSaved] = useState(values);

  function save(
    patch: Parameters<typeof updateWeekItem>[1],
    onSuccess?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await updateWeekItem(item.id, patch);
      if (result.ok) {
        onSuccess?.();
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      } else {
        setError(result.error);
      }
    });
  }

  function saveField(field: Field) {
    if (values[field] === saved[field]) return;
    save(
      { [field]: values[field] } as Parameters<typeof updateWeekItem>[1],
      () => setSaved((s) => ({ ...s, [field]: values[field] })),
    );
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeWeekItem(item.id);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  const input = (field: Field, label: string, suffix: string) => (
    <div className="grid gap-1">
      <Label
        htmlFor={`${field}-${item.id}`}
        className="text-xs text-muted-foreground"
      >
        {label}
      </Label>
      <div className="flex items-center gap-1.5">
        <Input
          id={`${field}-${item.id}`}
          inputMode="decimal"
          autoComplete="off"
          value={values[field]}
          disabled={readOnly}
          onChange={(e) =>
            setValues((v) => ({ ...v, [field]: e.target.value }))
          }
          onBlur={() => saveField(field)}
          className="h-11 w-24 text-right text-base tabular-nums"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  );

  return (
    <li
      className={cn(
        "rounded-2xl border border-border bg-card p-3 sm:p-4",
        !listed && "bg-muted/40",
        error && "border-destructive/50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg leading-tight font-semibold">
            {item.name}
            {!item.productActive && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({t("archived")})
              </span>
            )}
          </p>
          {item.orderedQuantity > 0 && (
            <p className="text-sm text-primary">
              {t("ordered", {
                quantity: formatQuantity(item.orderedQuantity, locale),
                unit,
              })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-muted-foreground">
            {pending ? (
              <Loader2
                className="size-4 animate-spin"
                aria-label={t("saving")}
              />
            ) : status === "saved" ? (
              <Check className="size-4 text-primary" aria-label={t("saved")} />
            ) : null}
          </span>
          <Label className="flex items-center gap-2 font-normal">
            <Checkbox
              checked={listed}
              disabled={readOnly}
              className="size-5"
              onCheckedChange={(checked) => {
                const next = checked === true;
                setListed(next);
                save({ listed: next });
              }}
            />
            {t("listed")}
          </Label>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-4">
        {input("availableQuantity", t("available"), unit)}
        {input("price", t("price"), `${currencyLabel} / ${unit}`)}
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          {t("more")}
        </summary>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          {input("minimumQuantity", t("minimum"), unit)}
          {input("maximumQuantity", t("maximum"), unit)}
          {!readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={remove}
            >
              <Trash2 aria-hidden />
              {t("remove")}
            </Button>
          )}
        </div>
      </details>

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {tErr(error)}
        </p>
      )}
    </li>
  );
}
