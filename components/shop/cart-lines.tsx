"use client";

import { X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Button } from "@/components/ui/button";
import {
  decrement,
  increment,
  maxQuantity,
  type CartSummary,
} from "@/lib/cart/math";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type CartLinesProps = {
  summary: CartSummary;
  currency: string;
  onChange: (itemId: string, quantity: number) => void;
  /** Item ids to highlight (e.g. not enough stock at checkout). */
  highlight?: string[];
};

/** Editable list of cart lines, shared by the cart drawer and checkout. */
export function CartLines({
  summary,
  currency,
  onChange,
  highlight = [],
}: CartLinesProps) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const unit = useUnitLabel();

  return (
    <ul className="divide-y divide-border">
      {summary.lines.map(({ item, quantity, total }) => (
        <li
          key={item.id}
          className={cn(
            "flex flex-col gap-2 py-3",
            highlight.includes(item.id) && "rounded-lg bg-destructive/5 px-2",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatMoney(item.price, currency, locale)} /{" "}
                {unit(item.unitCode)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-semibold tabular-nums">
                {formatMoney(total, currency, locale)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(item.id, 0)}
                aria-label={t("remove", { name: item.name })}
              >
                <X aria-hidden />
              </Button>
            </div>
          </div>
          <QuantityStepper
            name={item.name}
            quantity={quantity}
            unitLabel={unit(item.unitCode)}
            canIncrease={quantity < maxQuantity(item)}
            onDecrease={() => onChange(item.id, decrement(item, quantity))}
            onIncrease={() => onChange(item.id, increment(item, quantity))}
            className="max-w-56"
          />
        </li>
      ))}
    </ul>
  );
}
