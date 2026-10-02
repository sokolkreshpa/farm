import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrepareWeek } from "@/components/farmer/prepare-week";
import { Link, redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getCycles, getFarmSettings } from "@/lib/farm/queries";
import {
  addDays,
  dateInZone,
  mondayOf,
  nextWeekToPrepare,
} from "@/lib/farm/weeks";
import { getDateFormatters } from "@/lib/i18n/dates";

/**
 * "Manage this week's products": opens the week that needs attention —
 * an upcoming draft, else the open published week, else offers to prepare
 * the next week (flow 2 in docs/user-flows.md).
 */
export default async function CurrentWeekPage({
  params,
}: PageProps<"/[locale]/farm/week">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const [settings, cycles, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getCycles(tenant.id),
    getTranslations("Week"),
  ]);

  const today = dateInZone(new Date(), settings.timezone);
  const draft = cycles.find(
    (c) => c.status === "DRAFT" && c.weekStart >= mondayOf(today),
  );
  const open = cycles.find(
    (c) => c.status === "PUBLISHED" && new Date(c.deadline) > new Date(),
  );
  const target = draft ?? open;
  if (target) redirect({ href: `/farm/weeks/${target.id}`, locale });

  const weekStart = nextWeekToPrepare(cycles[0]?.weekStart ?? null, today);
  const dates = await getDateFormatters(settings.timezone);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="mb-6 flex items-baseline justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <Link
          href="/farm/weeks"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("allWeeks")}
        </Link>
      </div>
      <PrepareWeek
        weekStart={weekStart}
        sourceCycleId={cycles[0]?.id ?? null}
        title={t("prepareTitle", {
          start: dates.day(weekStart),
          end: dates.day(addDays(weekStart, 6)),
        })}
      />
    </main>
  );
}
