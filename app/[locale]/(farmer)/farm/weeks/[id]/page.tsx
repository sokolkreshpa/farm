import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AddWeekItem } from "@/components/farmer/add-week-item";
import { CycleStatusBadge } from "@/components/farmer/cycle-status-badge";
import { WeekControls } from "@/components/farmer/week-controls";
import { WeekItemRow } from "@/components/farmer/week-item-row";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getCycleEditor, getFarmSettings } from "@/lib/farm/queries";
import { utcToZoned } from "@/lib/farm/weeks";
import { currencyLabel as labelFor } from "@/lib/format";
import { getDateFormatters } from "@/lib/i18n/dates";

const UUID = /^[0-9a-f-]{36}$/i;

// Spec §14: the week's products as one editable list + Copy / Publish.
export default async function WeekEditorPage({
  params,
}: PageProps<"/[locale]/farm/weeks/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const { tenant } = await requireFarmer();

  const [settings, editor, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getCycleEditor(tenant.id, id),
    getTranslations("Week"),
  ]);
  if (!editor) notFound();
  const { cycle, items, available } = editor;
  const dates = await getDateFormatters(settings.timezone);
  const zoned = utcToZoned(new Date(cycle.deadline), settings.timezone);
  const closed = cycle.status === "CLOSED";
  const currencyLabel = labelFor(settings.currency, locale);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href="/farm/weeks"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← {t("allWeeks")}
        </Link>
        <Link
          href={`/f/${settings.slug}`}
          target="_blank"
          className="inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"
        >
          {t("viewShop")} <ExternalLink className="size-3.5" aria-hidden />
        </Link>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold">
          {t("range", {
            start: dates.day(cycle.weekStart),
            end: dates.day(cycle.weekEnd),
          })}
        </h1>
        <CycleStatusBadge status={cycle.status} />
      </div>
      {cycle.status === "PUBLISHED" && (
        <p className="mt-1 text-primary">
          {t("published", { deadline: dates.deadline(cycle.deadline) })}
        </p>
      )}
      {closed && (
        <p className="mt-2 rounded-xl bg-muted px-4 py-3">
          {t("closedNotice")}
        </p>
      )}

      <section className="mt-6 rounded-2xl bg-secondary/50 p-4">
        <WeekControls
          cycleId={cycle.id}
          status={cycle.status}
          deadlineInput={`${zoned.date}T${zoned.time}`}
          deadlineLabel={dates.deadline(cycle.deadline)}
          message={cycle.message ?? ""}
        />
      </section>

      <section className="mt-8" aria-labelledby="items-heading">
        <h2 id="items-heading" className="sr-only">
          {t("title")}
        </h2>
        {items.length === 0 ? (
          <p className="mb-4 text-muted-foreground">{t("noItems")}</p>
        ) : (
          <ul className="mb-4 grid gap-3">
            {items.map((item) => (
              <WeekItemRow
                key={item.id}
                item={item}
                currencyLabel={currencyLabel}
                readOnly={closed}
              />
            ))}
          </ul>
        )}
        {!closed && (
          <AddWeekItem
            cycleId={cycle.id}
            products={available}
            currencyLabel={currencyLabel}
          />
        )}
      </section>

      {cycle.status === "PUBLISHED" && (
        <p className="mt-8 text-sm">
          <Link
            href="/farm/weeks"
            className="text-primary underline-offset-4 hover:underline"
          >
            {t("nextWeek")} →
          </Link>
        </p>
      )}
    </main>
  );
}
