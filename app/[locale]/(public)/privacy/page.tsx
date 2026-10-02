import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/i18n/routing";

const SECTIONS = ["who", "data", "why", "share", "keep", "rights"] as const;

export default async function PrivacyPage({
  params,
}: PageProps<"/[locale]/privacy">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Privacy");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <p className="mt-2 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
          {t("draftNotice")}
        </p>
        <p className="mt-6 leading-relaxed">{t("intro")}</p>
        {SECTIONS.map((key) => (
          <section key={key} className="mt-6">
            <h2 className="font-heading text-xl font-semibold">
              {t(`sections.${key}.title`)}
            </h2>
            <p className="mt-2 leading-relaxed text-muted-foreground">
              {t(`sections.${key}.body`)}
            </p>
          </section>
        ))}
      </main>
    </>
  );
}
