"use client";

import { RotateCcw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { openCart } from "@/components/shop/cart-events";
import { useUnitLabel } from "@/components/shop/use-unit-label";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/use-cart";
import { formatMoney, formatQuantity } from "@/lib/format";
import { repeatToCart, type RepeatLine } from "@/lib/orders/repeat";
import { cn } from "@/lib/utils";

type RepeatOrderCardProps = {
  slug: string;
  cycleId: string | null;
  currency: string;
  orderNumber: number;
  placedOn: string; // already formatted
  lines: RepeatLine[];
  highlighted?: boolean;
};

export function RepeatOrderCard({
  slug,
  cycleId,
  currency,
  orderNumber,
  placedOn,
  lines,
  highlighted,
}: RepeatOrderCardProps) {
  const t = useTranslations("Repeat");
  const locale = useLocale();
  const unit = useUnitLabel();
  const { lines: cart, replace } = useCart(slug, cycleId ?? "none");
  const repeatable = repeatToCart(lines);
  const canRepeat = cycleId !== null && Object.keys(repeatable).length > 0;

  function repeat() {
    if (Object.keys(cart).length > 0 && !window.confirm(t("replaceConfirm"))) {
      return;
    }
    replace(repeatable);
    openCart();
  }

  return (
    <section
      aria-labelledby="repeat-title"
      className={cn(
        "rounded-2xl border border-border bg-card p-4 sm:p-5",
        highlighted && "border-primary ring-2 ring-primary/20",
      )}
    >
      <div className="flex items-start gap-3">
        <RotateCcw className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <h2 id="repeat-title" className="font-heading text-xl font-semibold">
            {t("title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("subtitle", { number: orderNumber, date: placedOn })}
          </p>
        </div>
      </div>

      <ul className="mt-3 divide-y divide-border text-sm">
        {lines.map((line) => (
          <li
            key={line.productId}
            className="flex items-baseline justify-between gap-3 py-2"
          >
            <span
              className={cn(
                line.status === "unavailable" &&
                  "text-muted-foreground line-through",
              )}
            >
              {line.name}
            </span>
            <span className="text-right">
              {line.status === "unavailable" ? (
                <span className="text-muted-foreground">
                  {t("notAvailable")}
                </span>
              ) : (
                <>
                  <span className="font-medium tabular-nums">
                    {formatQuantity(line.quantity, locale)}{" "}
                    {unit(line.unitCode)}
                  </span>
                  {line.status === "reduced" && (
                    <span className="block text-xs text-amber-700">
                      {t("reduced", {
                        quantity: formatQuantity(line.quantity, locale),
                        unit: unit(line.unitCode),
                      })}
                    </span>
                  )}
                  {line.priceChanged && line.item && (
                    <span className="block text-xs text-muted-foreground">
                      {t("priceNow", {
                        price: formatMoney(line.item.price, currency, locale),
                      })}
                    </span>
                  )}
                </>
              )}
            </span>
          </li>
        ))}
      </ul>

      {canRepeat ? (
        <Button
          size="lg"
          className="mt-3 h-12 w-full text-base sm:w-auto"
          onClick={repeat}
        >
          {t("button")}
        </Button>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          {cycleId ? t("nothingAvailable") : t("closedHint")}
        </p>
      )}
    </section>
  );
}
