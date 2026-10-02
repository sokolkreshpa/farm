"use client";

import { Minus, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type QuantityStepperProps = {
  name: string;
  quantity: number;
  unitLabel: string;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  className?: string;
};

/** [-] 2 kg [+] with large tap targets. */
export function QuantityStepper({
  name,
  quantity,
  unitLabel,
  canIncrease,
  onDecrease,
  onIncrease,
  className,
}: QuantityStepperProps) {
  const t = useTranslations("Shop");
  const locale = useLocale();

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-1 rounded-xl border border-primary/30 bg-accent/60 p-1",
        className,
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="size-10 rounded-lg"
        onClick={onDecrease}
        aria-label={t("decrease", { name })}
      >
        <Minus className="size-5" aria-hidden />
      </Button>
      <output
        aria-live="polite"
        className="min-w-16 text-center text-base font-semibold tabular-nums"
      >
        {formatQuantity(quantity, locale)} {unitLabel}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-lg"
        className="size-10 rounded-lg"
        onClick={onIncrease}
        disabled={!canIncrease}
        aria-label={t("increase", { name })}
      >
        <Plus className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
