import { ExternalLink, Plus } from "lucide-react";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { setFarmActive } from "@/lib/admin/actions";
import { getAdminFarms, getDeletionRequests } from "@/lib/admin/queries";
import { requirePlatformAdmin } from "@/lib/dal/session";
import { cn } from "@/lib/utils";

export default async function AdminPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  await requirePlatformAdmin();
  const [farms, requests, t, format] = await Promise.all([
    getAdminFarms(),
    getDeletionRequests(),
    getTranslations("Admin"),
    getFormatter(),
  ]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">{t("farms")}</h1>
        <Button asChild size="lg">
          <Link href="/admin/farms/new">
            <Plus aria-hidden /> {t("newFarm")}
          </Link>
        </Button>
      </div>

      <ul className="mt-6 grid gap-3">
        {farms.map((farm) => (
          <li
            key={farm.id}
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4",
              !farm.active && "opacity-70",
            )}
          >
            <div className="min-w-0">
              <p className="font-heading text-lg font-semibold">
                {farm.name}{" "}
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold",
                    farm.active
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {farm.active ? t("active") : t("inactive")}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">
                /f/{farm.slug} ·{" "}
                {farm.farmers.length
                  ? farm.farmers.map((f) => `${f.name} <${f.email}>`).join(", ")
                  : t("noFarmer")}
              </p>
              <p className="text-sm text-muted-foreground">
                {t("customers", { count: farm.customerCount })} ·{" "}
                {t("orders", { count: farm.orderCount })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {farm.active && (
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/f/${farm.slug}`} target="_blank">
                    <ExternalLink aria-hidden />
                  </Link>
                </Button>
              )}
              <form action={setFarmActive.bind(null, farm.id, !farm.active)}>
                <Button type="submit" variant="outline" size="sm">
                  {farm.active ? t("deactivate") : t("activate")}
                </Button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-semibold">
          {t("deletionRequests")}
        </h2>
        {requests.length === 0 ? (
          <p className="mt-2 text-muted-foreground">
            {t("noDeletionRequests")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-2xl border border-border bg-card">
            {requests.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap justify-between gap-2 px-4 py-3"
              >
                <span>
                  {r.name}{" "}
                  <span className="text-muted-foreground">
                    &lt;{r.email}&gt;
                  </span>
                </span>
                <span className="text-sm text-muted-foreground">
                  {t("requestedOn", {
                    date: format.dateTime(new Date(r.requestedAt), {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    }),
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
