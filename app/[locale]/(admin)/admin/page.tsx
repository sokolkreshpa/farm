import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requirePlatformAdmin } from "@/lib/dal/session";

// Phase 5: farms list, create farm + invite farmer.
export default async function AdminPage({
  params,
}: PageProps<"/[locale]/admin">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [, t] = await Promise.all([
    requirePlatformAdmin(),
    getTranslations("AdminArea"),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-6 text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
