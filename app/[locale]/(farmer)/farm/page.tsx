import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";

// Phase 5: dashboard (this week's orders, products, expected sales).
export default async function FarmDashboardPage({
  params,
}: PageProps<"/[locale]/farm">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [{ tenant }, t] = await Promise.all([
    requireFarmer(),
    getTranslations("FarmerArea"),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <p className="text-sm font-medium text-primary">{tenant.name}</p>
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-6 text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
