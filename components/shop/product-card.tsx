"use client";

import { useLocale, useTranslations } from "next-intl";
import { ProductImage } from "@/components/products/product-image";
import { QuantityStepper } from "@/components/shop/quantity-stepper";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Button } from "@/components/ui/button";
import {
  decrement,
  increment,
  isSoldOut,
  maxQuantity,
  minQuantity,
} from "@/lib/cart/math";
import type { OfferItem } from "@/lib/catalog/types";
import { formatMoney, formatQuantity } from "@/lib/format";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  item: OfferItem;
  currency: string;
  quantity: number;
  ordering: boolean;
  onChange: (quantity: number) => void;
};

const LOW_STOCK_STEPS = 10;

export function ProductCard({
  item,
  currency,
  quantity,
  ordering,
  onChange,
}: ProductCardProps) {
  const t = useTranslations("Shop");
  const locale = useLocale();
  const unit = useUnitLabel();
  const unitLabel = unit(item.unitCode);
  const soldOut = isSoldOut(item);
  const max = maxQuantity(item);
  const lowStock =
    !soldOut &&
    item.remaining !== null &&
    item.remaining <= item.step * LOW_STOCK_STEPS;

  return (
    <article
      className={cn(
        "flex gap-4 rounded-2xl border border-border bg-card p-3 shadow-xs sm:flex-col sm:p-4",
        soldOut && "opacity-60",
      )}
    >
      <ProductImage
        name={item.name}
        imageUrl={item.imageUrl}
        className="size-24 shrink-0 sm:aspect-[5/2] sm:size-auto sm:w-full"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="font-heading text-lg leading-tight font-semibold">
          {item.name}
        </h3>
        {item.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {item.description}
          </p>
        )}
        <p className="mt-1 text-base font-semibold">
          {t("perUnit", {
            price: formatMoney(item.price, currency, locale),
            unit: unitLabel,
          })}
        </p>
        <p className="min-h-5 text-xs text-muted-foreground">
          {soldOut
            ? t("soldOut")
            : lowStock
              ? t("lowStock", {
                  quantity: formatQuantity(item.remaining ?? 0, locale),
                  unit: unitLabel,
                })
              : item.minimum && item.minimum > item.step
                ? t("minimum", {
                    quantity: formatQuantity(minQuantity(item), locale),
                    unit: unitLabel,
                  })
                : item.maximum
                  ? t("maximum", {
                      quantity: formatQuantity(item.maximum, locale),
                      unit: unitLabel,
                    })
                  : null}
        </p>
        {ordering && !soldOut && (
          <div className="mt-auto pt-2">
            {quantity > 0 ? (
              <QuantityStepper
                name={item.name}
                quantity={quantity}
                unitLabel={unitLabel}
                canIncrease={quantity < max}
                onDecrease={() => onChange(decrement(item, quantity))}
                onIncrease={() => onChange(increment(item, quantity))}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full rounded-xl border-primary/40 text-base text-primary"
                onClick={() => onChange(increment(item, 0))}
              >
                {t("add")}
              </Button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
