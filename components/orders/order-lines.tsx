import { getLocale, getTranslations } from "next-intl/server";
import { formatMoney, formatQuantity } from "@/lib/format";
import type { CustomerOrder } from "@/lib/orders/queries";

/** Read-only order lines with snapshot prices and totals. */
export async function OrderLines({ order }: { order: CustomerOrder }) {
  const [locale, t, tUnits, tCheckout] = await Promise.all([
    getLocale(),
    getTranslations("Orders"),
    getTranslations("Units"),
    getTranslations("Checkout"),
  ]);
  const unit = (code: string) =>
    tUnits.has(code as never) ? tUnits(code as never) : code;
  const money = (amount: number) => formatMoney(amount, order.currency, locale);

  return (
    <section aria-label={t("items")}>
      <ul className="divide-y divide-border">
        {order.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-3 py-2.5">
            <span>
              <span className="font-medium">{line.name}</span>
              <span className="block text-sm text-muted-foreground">
                {formatQuantity(line.quantity, locale)} {unit(line.unitCode)} ×{" "}
                {money(line.unitPrice)}
              </span>
            </span>
            <span className="tabular-nums">{money(line.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-2 grid gap-1 border-t border-border pt-3">
        <div className="flex justify-between">
          <dt>{tCheckout("subtotal")}</dt>
          <dd className="tabular-nums">{money(order.subtotal)}</dd>
        </div>
        {order.deliveryMethod === "DELIVERY" && (
          <div className="flex justify-between">
            <dt>{tCheckout("deliveryFee")}</dt>
            <dd className="tabular-nums">{money(order.deliveryFee)}</dd>
          </div>
        )}
        <div className="flex justify-between text-lg font-semibold">
          <dt>{tCheckout("total")}</dt>
          <dd className="tabular-nums">{money(order.total)}</dd>
        </div>
      </dl>
    </section>
  );
}
