import { MessageCircle, Phone, Truck, Warehouse } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrderActions } from "@/components/farmer/order-actions";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getFarmOrder, getFarmSettings } from "@/lib/farm/queries";
import { formatMoney, formatQuantity } from "@/lib/format";
import { getDateFormatters } from "@/lib/i18n/dates";

const UUID = /^[0-9a-f-]{36}$/i;

/** Albanian mobile numbers ("069 123 4567") as international digits for wa.me. */
function whatsappNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("355")) return digits;
  if (digits.startsWith("0")) return `355${digits.slice(1)}`;
  return digits;
}

// Spec §15B: one order with contact, delivery info and the next-status button.
export default async function FarmOrderPage({
  params,
}: PageProps<"/[locale]/farm/orders/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const { tenant } = await requireFarmer();

  const [settings, order, t, tCheckout, tMethod, tStatus, tUnits] =
    await Promise.all([
      getFarmSettings(tenant.id),
      getFarmOrder(tenant.id, id),
      getTranslations("FarmOrders"),
      getTranslations("Checkout"),
      getTranslations("DeliveryMethod"),
      getTranslations("OrderStatus"),
      getTranslations("Units"),
    ]);
  if (!order) notFound();
  const dates = await getDateFormatters(settings.timezone);
  const unit = (code: string) =>
    tUnits.has(code as never) ? tUnits(code as never) : code;
  const money = (amount: number) => formatMoney(amount, order.currency, locale);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href={`/farm/orders?tab=list&week=${order.cycleId}`}
        className="text-sm text-primary underline-offset-4 hover:underline print:hidden"
      >
        ← {t("back")}
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">
          #{order.orderNumber}
        </h1>
        <StatusBadge status={order.status} className="text-sm" />
      </div>
      <p className="text-sm text-muted-foreground">
        {t("placedAt", { date: dates.dateTime(order.placedAt) })}
      </p>

      <section
        className="mt-6 rounded-2xl border border-border bg-card p-4"
        aria-label={t("customer")}
      >
        <p className="font-heading text-xl font-semibold">
          <Link
            href={`/farm/customers/${order.customerId}`}
            className="hover:underline"
          >
            {order.customerName}
          </Link>
        </p>
        <p className="text-muted-foreground">{order.customerPhone}</p>
        <div className="mt-3 flex flex-wrap gap-2 print:hidden">
          <Button asChild variant="outline" size="sm">
            <a href={`tel:${order.customerPhone.replace(/\s/g, "")}`}>
              <Phone aria-hidden /> {t("call")}
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a
              href={`https://wa.me/${whatsappNumber(order.customerPhone)}`}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle aria-hidden /> {t("whatsapp")}
            </a>
          </Button>
        </div>
        <div className="mt-4 flex gap-2">
          {order.deliveryMethod === "DELIVERY" ? (
            <Truck
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden
            />
          ) : (
            <Warehouse
              className="mt-0.5 size-5 shrink-0 text-primary"
              aria-hidden
            />
          )}
          <div>
            <p className="font-medium">{tMethod(order.deliveryMethod)}</p>
            {order.deliveryAddress && (
              <p>
                {order.deliveryAddress}
                {order.deliveryCity ? `, ${order.deliveryCity}` : ""}
              </p>
            )}
            {order.deliveryNotes && (
              <p className="text-sm whitespace-pre-line text-muted-foreground">
                {order.deliveryNotes}
              </p>
            )}
          </div>
        </div>
        {order.notes && (
          <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm whitespace-pre-line">
            <span className="font-medium">{t("customerNotes")}:</span> “
            {order.notes}”
          </p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-4">
        <table className="w-full text-base">
          <tbody>
            {order.lines.map((line) => (
              <tr
                key={line.id}
                className="border-b border-border last:border-0"
              >
                <th scope="row" className="py-2 pr-2 text-left font-medium">
                  {line.name}
                </th>
                <td className="py-2 text-right font-semibold whitespace-nowrap tabular-nums">
                  {formatQuantity(line.quantity, locale)} {unit(line.unitCode)}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                  {money(line.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-3 grid gap-1 border-t border-border pt-3">
          {order.deliveryMethod === "DELIVERY" && (
            <div className="flex justify-between text-sm">
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

      <div className="mt-6">
        <OrderActions orderId={order.id} status={order.status} />
      </div>

      <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-heading text-lg font-semibold">
          {t("history")}
        </h2>
        <ol className="mt-2 grid gap-1 text-sm">
          {order.history.map((h, index) => (
            <li key={index} className="flex justify-between gap-3">
              <span>
                {tStatus(h.to)}
                {h.note && (
                  <span className="text-muted-foreground"> — {h.note}</span>
                )}
              </span>
              <span className="text-muted-foreground">
                {dates.dateTime(h.at)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
