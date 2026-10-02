import {
  getFormatter,
  getLocale,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireViewer } from "@/lib/dal/session";
import { formatMoney } from "@/lib/format";
import { getMyOrders } from "@/lib/orders/queries";

export default async function OrdersPage({
  params,
}: PageProps<"/[locale]/account/orders">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const viewer = await requireViewer("/account/orders");
  const [orders, t, format, currentLocale] = await Promise.all([
    getMyOrders(viewer.id),
    getTranslations("Orders"),
    getFormatter(),
    getLocale(),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>

      {orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-8 text-center">
          <p className="text-muted-foreground">{t("empty")}</p>
          <Button asChild className="mt-4" size="lg">
            <Link href="/">{t("goShopping")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-heading text-lg font-semibold">
                    {t("orderNumber", { number: order.orderNumber })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.farm.name} ·{" "}
                    {format.dateTime(new Date(order.placedAt), {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                {order.lines.map((l) => l.name).join(", ")}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="font-semibold tabular-nums">
                  {formatMoney(order.total, order.currency, currentLocale)}
                </span>
                <div className="flex gap-2">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/account/orders/${order.id}`}>
                      {t("view")}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/f/${order.farm.slug}?repeat=${order.id}`}>
                      {t("repeat")}
                    </Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
