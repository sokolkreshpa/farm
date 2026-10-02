import { CalendarClock } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CopyLink } from "@/components/farmer/copy-link";
import { Button } from "@/components/ui/button";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { publicEnv } from "@/lib/env";
import { aggregateTotals } from "@/lib/farm/aggregate";
import {
  getCurrentCycle,
  getCycleEditor,
  getCycleOrders,
  getFarmSettings,
} from "@/lib/farm/queries";
import { formatMoney } from "@/lib/format";
import { getDateFormatters } from "@/lib/i18n/dates";

// Spec §13: THIS WEEK — orders, products, expected sales, two big buttons.
export default async function FarmDashboardPage({
  params,
}: PageProps<"/[locale]/farm">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();

  const [settings, cycle, t, tStatus] = await Promise.all([
    getFarmSettings(tenant.id),
    getCurrentCycle(tenant.id),
    getTranslations("Dashboard"),
    getTranslations("CycleStatus"),
  ]);
  const dates = await getDateFormatters(settings.timezone);
  const [orders, editor] = cycle
    ? await Promise.all([
        getCycleOrders(tenant.id, cycle.id),
        getCycleEditor(tenant.id, cycle.id),
      ])
    : [[], null];

  const totals = aggregateTotals(orders);
  const toPrepare = orders.filter((o) =>
    ["PLACED", "CONFIRMED", "PREPARING"].includes(o.status),
  ).length;
  const listedProducts = editor?.items.filter((i) => i.listed).length ?? 0;
  const shopUrl = new URL(
    getPathname({ href: `/f/${settings.slug}`, locale }),
    publicEnv.NEXT_PUBLIC_SITE_URL,
  ).toString();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-heading text-3xl font-semibold tracking-wide uppercase">
          {t("thisWeek")}
        </h1>
        {cycle && (
          <p className="text-muted-foreground">
            {t("week", {
              start: dates.day(cycle.weekStart),
              end: dates.day(cycle.weekEnd),
            })}{" "}
            · {tStatus(cycle.status)}
          </p>
        )}
      </div>

      {cycle ? (
        <>
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <CalendarClock className="size-4" aria-hidden />
            {new Date(cycle.deadline) > new Date()
              ? t("deadline", { deadline: dates.deadline(cycle.deadline) })
              : t("deadlinePassed")}
          </p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={t("orders")} value={String(totals.orderCount)} />
            <Stat label={t("toPrepare")} value={String(toPrepare)} />
            <Stat label={t("products")} value={String(listedProducts)} />
            <Stat
              label={t("expectedSales")}
              value={formatMoney(totals.amount, settings.currency, locale)}
              wide
            />
          </dl>
        </>
      ) : (
        <div className="mt-6 rounded-2xl border border-dashed border-border px-5 py-6">
          <p className="font-heading text-lg font-semibold">
            {t("noWeekTitle")}
          </p>
          <p className="mt-1 text-muted-foreground">{t("noWeekBody")}</p>
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Button asChild size="lg" className="h-16 text-lg">
          <Link href="/farm/week">{t("manageWeek")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-16 text-lg">
          <Link href="/farm/orders">{t("viewOrders")}</Link>
        </Button>
      </div>

      <section className="mt-10 rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="font-heading text-lg font-semibold">
          {t("shareTitle")}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("shareBody")}</p>
        <CopyLink url={shopUrl} />
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div
      className={
        wide
          ? "col-span-2 rounded-2xl bg-accent p-4 sm:col-span-1"
          : "rounded-2xl bg-card p-4 ring-1 ring-border"
      }
    >
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
