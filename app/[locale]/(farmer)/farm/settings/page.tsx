import { getTranslations, setRequestLocale } from "next-intl/server";
import { SettingsForm } from "@/components/farmer/settings-form";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getFarmSettings } from "@/lib/farm/queries";

export default async function FarmSettingsPage({
  params,
}: PageProps<"/[locale]/farm/settings">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const [settings, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getTranslations("FarmSettings"),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <h1 className="mb-6 font-heading text-3xl font-semibold">{t("title")}</h1>
      <SettingsForm settings={settings} />
    </main>
  );
}
