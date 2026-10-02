"use client";

import { ShoppingBasket } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { onOpenCart } from "@/components/shop/cart-events";
import { CartLines } from "@/components/shop/cart-lines";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { summarizeCart } from "@/lib/cart/math";
import type { Offer } from "@/lib/catalog/types";
import { useOfferCart } from "@/lib/cart/use-cart";
import { formatMoney } from "@/lib/format";

type CartBarProps = { slug: string; offer: Offer; isLoggedIn: boolean };

/** Sticky bottom bar + cart drawer. */
export function CartBar({ slug, offer, isLoggedIn }: CartBarProps) {
  const t = useTranslations("Cart");
  const locale = useLocale();
  const { lines, adjusted, setQuantity } = useOfferCart(slug, offer);
  const [open, setOpen] = useState(false);

  useEffect(() => onOpenCart(() => setOpen(true)), []);

  const summary = useMemo(() => summarizeCart(lines, offer), [lines, offer]);
  if (!offer.isOpen || summary.count === 0) return null;

  const checkoutPath = `/f/${slug}/checkout`;
  const checkoutHref = isLoggedIn
    ? checkoutPath
    : `/register?farm=${slug}&next=${encodeURIComponent(checkoutPath)}`;
  const total = formatMoney(summary.subtotal, offer.currency, locale);

  return (
    <>
      <div className="h-24" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1 text-left"
            aria-label={t("open")}
          >
            <ShoppingBasket
              className="size-6 shrink-0 text-primary"
              aria-hidden
            />
            <span className="truncate font-medium">
              {t("summary", { count: summary.count, total })}
            </span>
          </button>
          <Button
            size="lg"
            className="h-12 px-5 text-base"
            onClick={() => setOpen(true)}
          >
            {t("continue")}
          </Button>
        </div>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="font-heading text-xl">
              {t("title")}
            </SheetTitle>
            {adjusted ? (
              <SheetDescription>{t("adjusted")}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">
                {t("summary", { count: summary.count, total })}
              </SheetDescription>
            )}
          </SheetHeader>
          <div className="overflow-y-auto px-4">
            <CartLines
              summary={summary}
              currency={offer.currency}
              onChange={setQuantity}
            />
          </div>
          <SheetFooter className="border-t border-border">
            <div className="flex items-center justify-between text-base">
              <span>{t("subtotal")}</span>
              <span className="font-semibold tabular-nums">{total}</span>
            </div>
            <Button asChild size="lg" className="h-12 text-base">
              <Link href={checkoutHref}>{t("checkout")}</Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
