import { CircleCheck, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { OrderLines } from "@/components/orders/order-lines";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireViewer } from "@/lib/dal/session";
import { getMyOrder } from "@/lib/orders/queries";

const UUID = /^[0-9a-f-]{36}$/i;

// Order detail; also the confirmation page right after checkout (?placed=1).
export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/[locale]/account/orders/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();

  const viewer = await requireViewer(`/account/orders/${id}`);
  const order = await getMyOrder(viewer.id, id);
  if (!order) notFound();

  const [query, t, tMethod, format] = await Promise.all([
    searchParams,
    getTranslations("Orders"),
    getTranslations("DeliveryMethod"),
    getFormatter(),
  ]);
  const justPlaced = query.placed === "1";
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      {justPlaced ? (
        <div className="mb-6 rounded-2xl bg-accent px-5 py-5 text-accent-foreground">
          <CircleCheck className="size-8 text-primary" aria-hidden />
          <h1 className="mt-2 font-heading text-2xl font-semibold">
            {t("thanksTitle", { number: order.orderNumber })}
          </h1>
          <p className="mt-1">{t("thanksBody")}</p>
        </div>
      ) : (
        <>
          <Link
            href="/account/orders"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            ← {t("backToOrders")}
          </Link>
          <h1 className="mt-3 font-heading text-3xl font-semibold">
            {t("orderNumber", { number: order.orderNumber })}
          </h1>
        </>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{order.farm.name}</span>
        <span>
          {t("placedOn", {
            date: format.dateTime(new Date(order.placedAt), {
              day: "numeric",
              month: "long",
              hour: "2-digit",
              minute: "2-digit",
              hourCycle: "h23",
            }),
          })}
        </span>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <OrderLines order={order} />
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t("week")}</dt>
          <dd>
            {day(order.week.start)} – {day(order.week.end)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">
            {order.deliveryMethod === "DELIVERY" ? t("delivery") : t("pickup")}
          </dt>
          <dd>
            {tMethod(order.deliveryMethod)}
            {order.deliveryAddress && (
              <span className="block">
                {order.deliveryAddress}
                {order.deliveryCity ? `, ${order.deliveryCity}` : ""}
              </span>
            )}
            {order.deliveryNotes && (
              <span className="block text-sm whitespace-pre-line text-muted-foreground">
                {order.deliveryNotes}
              </span>
            )}
          </dd>
        </div>
        {order.notes && (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{t("notes")}</dt>
            <dd className="whitespace-pre-line">{order.notes}</dd>
          </div>
        )}
      </dl>

      {order.farm.phone && (
        <p className="mt-8 flex flex-wrap items-center gap-2 rounded-xl bg-secondary px-4 py-3 text-secondary-foreground">
          <Phone className="size-4" aria-hidden />
          {t("changes")}
          <a
            href={`tel:${order.farm.phone.replace(/\s/g, "")}`}
            className="font-semibold underline underline-offset-4"
          >
            {order.farm.phone}
          </a>
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild variant="outline" size="lg">
          <Link href={`/f/${order.farm.slug}?repeat=${order.id}`}>
            {t("repeat")}
          </Link>
        </Button>
        {justPlaced && (
          <Button asChild variant="ghost" size="lg">
            <Link href="/account/orders">{t("backToOrders")}</Link>
          </Button>
        )}
      </div>
    </main>
  );
}
