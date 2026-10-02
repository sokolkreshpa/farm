import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { use } from "react";
import type { Locale } from "@/i18n/routing";

export default function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params) as { locale: Locale };
  setRequestLocale(locale);
  const t = useTranslations("Home");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
        {t("headline")}
      </h1>
      <p className="text-lg text-muted-foreground">{t("subheadline")}</p>
      <p className="text-sm font-medium text-primary">{t("comingSoon")}</p>
    </main>
  );
}
