import { ChevronRight } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PrepareWeek } from "@/components/farmer/prepare-week";
import { CycleStatusBadge } from "@/components/farmer/cycle-status-badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getCycles, getFarmSettings } from "@/lib/farm/queries";
import { addDays, dateInZone, nextWeekToPrepare } from "@/lib/farm/weeks";
import { getDateFormatters } from "@/lib/i18n/dates";

export default async function WeeksPage({
  params,
}: PageProps<"/[locale]/farm/weeks">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const [settings, cycles, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getCycles(tenant.id),
    getTranslations("Week"),
  ]);
  const dates = await getDateFormatters(settings.timezone);
  const next = nextWeekToPrepare(
    cycles[0]?.weekStart ?? null,
    dateInZone(new Date(), settings.timezone),
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="font-heading text-3xl font-semibold">{t("allWeeks")}</h1>

      <div className="mt-6">
        <PrepareWeek
          weekStart={next}
          sourceCycleId={cycles[0]?.id ?? null}
          title={t("prepareTitle", {
            start: dates.day(next),
            end: dates.day(addDays(next, 6)),
          })}
        />
      </div>

      {cycles.length === 0 ? (
        <p className="mt-6 text-muted-foreground">{t("noWeeks")}</p>
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
          {cycles.map((cycle) => (
            <li key={cycle.id}>
              <Link
                href={`/farm/weeks/${cycle.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
              >
                <span>
                  <span className="block font-medium">
                    {t("range", {
                      start: dates.day(cycle.weekStart),
                      end: dates.day(cycle.weekEnd),
                    })}
                  </span>
                  <span className="block text-sm text-muted-foreground">
                    {dates.deadline(cycle.deadline)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <CycleStatusBadge status={cycle.status} />
                  <ChevronRight
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
