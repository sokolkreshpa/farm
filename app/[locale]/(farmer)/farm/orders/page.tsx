import { getTranslations, setRequestLocale } from "next-intl/server";
import { OrdersList } from "@/components/farmer/orders-list";
import { PrintButton } from "@/components/farmer/print-button";
import { WeekSelect } from "@/components/farmer/week-select";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { ACTIVE_STATUSES, aggregateTotals } from "@/lib/farm/aggregate";
import {
  getCurrentCycle,
  getCycleOrders,
  getCycles,
  getFarmSettings,
} from "@/lib/farm/queries";
import { formatMoney, formatQuantity } from "@/lib/format";
import { getDateFormatters } from "@/lib/i18n/dates";
import { cn } from "@/lib/utils";

const TO_PREPARE = ["PLACED", "CONFIRMED", "PREPARING"] as const;

// Spec §15: totals first ("How much do I need to prepare?"), then orders.
export default async function FarmOrdersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/farm/orders">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const query = await searchParams;
  const tab = query.tab === "list" ? "list" : "totals";
  const onlyToPrepare = query.only === "prepare";

  const [settings, cycles, current, t, tUnits] = await Promise.all([
    getFarmSettings(tenant.id),
    getCycles(tenant.id),
    getCurrentCycle(tenant.id),
    getTranslations("FarmOrders"),
    getTranslations("Units"),
  ]);
  const cycle = cycles.find((c) => c.id === query.week) ?? current ?? null;
  const dates = await getDateFormatters(settings.timezone);

  if (!cycle) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-6 text-muted-foreground">{t("noOrders")}</p>
      </main>
    );
  }

  const orders = await getCycleOrders(tenant.id, cycle.id);
  const totals = aggregateTotals(
    orders,
    onlyToPrepare ? [...TO_PREPARE] : ACTIVE_STATUSES,
  );
  const unit = (code: string) =>
    tUnits.has(code as never) ? tUnits(code as never) : code;
  const weekLabel = (c: { weekStart: string; weekEnd: string }) =>
    `${dates.day(c.weekStart)} – ${dates.day(c.weekEnd)}`;
  const href = (params: Record<string, string>) =>
    `/farm/orders?${new URLSearchParams({ week: cycle.id, ...params })}`;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <WeekSelect
          value={cycle.id}
          weeks={cycles.map((c) => ({ id: c.id, label: weekLabel(c) }))}
          keep={{ tab }}
        />
      </div>

      <div
        role="tablist"
        className="mt-6 flex gap-1 rounded-xl bg-muted p-1 print:hidden"
      >
        {(["totals", "list"] as const).map((key) => (
          <Link
            key={key}
            role="tab"
            aria-selected={tab === key}
            href={href({ tab: key })}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-center text-sm font-medium",
              tab === key ? "bg-background shadow-xs" : "text-muted-foreground",
            )}
          >
            {key === "totals"
              ? t("totalsTab")
              : `${t("listTab")} (${orders.length})`}
          </Link>
        ))}
      </div>

      {tab === "totals" ? (
        <section className="mt-6" aria-labelledby="totals-heading">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2
                id="totals-heading"
                className="font-heading text-2xl font-semibold tracking-wide uppercase"
              >
                {t("totalsTitle")}
              </h2>
              <p className="text-muted-foreground">
                {weekLabel(cycle)} ·{" "}
                {t("orderCount", { count: totals.orderCount })} ·{" "}
                {formatMoney(totals.amount, settings.currency, locale)}
              </p>
            </div>
            <PrintButton label={t("print")} />
          </div>
          <div className="mt-3 flex gap-3 text-sm print:hidden">
            <Link
              href={href({ tab: "totals" })}
              aria-current={!onlyToPrepare ? "true" : undefined}
              className={cn(
                !onlyToPrepare
                  ? "font-semibold text-foreground"
                  : "text-primary underline-offset-4 hover:underline",
              )}
            >
              {t("allActive")}
            </Link>
            <Link
              href={href({ tab: "totals", only: "prepare" })}
              aria-current={onlyToPrepare ? "true" : undefined}
              className={cn(
                onlyToPrepare
                  ? "font-semibold text-foreground"
                  : "text-primary underline-offset-4 hover:underline",
              )}
            >
              {t("onlyToPrepare")}
            </Link>
          </div>

          {totals.products.length === 0 ? (
            <p className="mt-6 text-muted-foreground">{t("noOrders")}</p>
          ) : (
            <table className="mt-4 w-full border-collapse text-lg">
              <caption className="sr-only">{t("totalsHint")}</caption>
              <tbody>
                {totals.products.map((p) => (
                  <tr key={p.productId} className="border-b border-border">
                    <th scope="row" className="py-3 pr-3 text-left font-medium">
                      {p.name}
                    </th>
                    <td className="py-3 text-right text-2xl font-bold whitespace-nowrap tabular-nums">
                      {formatQuantity(p.quantity, locale)} {unit(p.unitCode)}
                    </td>
                    <td className="py-3 pl-3 text-right text-sm whitespace-nowrap text-muted-foreground">
                      {t("productOrders", { count: p.orderCount })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : (
        <section className="mt-6">
          <OrdersList
            orders={orders.map((o) => ({
              id: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              deliveryMethod: o.deliveryMethod,
              customerName: o.customerName,
              customerPhone: o.customerPhone,
              total: o.total,
              currency: o.currency,
              placedAt: dates.dateTime(o.placedAt),
              summary: o.lines
                .map(
                  (l) =>
                    `${l.name} ${formatQuantity(l.quantity, locale)} ${unit(l.unitCode)}`,
                )
                .join(", "),
            }))}
          />
        </section>
      )}
    </main>
  );
}
