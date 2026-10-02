import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { requireViewer } from "@/lib/dal/session";

export default async function AccountPage({
  params,
}: PageProps<"/[locale]/account">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [viewer, t] = await Promise.all([
    requireViewer("/account"),
    getTranslations("Account"),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-lg">
        {t("greeting", { name: viewer.firstName })}
      </p>
      <p className="mt-6 text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
