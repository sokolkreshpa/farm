import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { redirect } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { serverEnv } from "@/lib/env.server";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);

  // Single-farm deployment: "/" goes straight to the farm (D-42).
  const defaultSlug = serverEnv().DEFAULT_TENANT_SLUG;
  if (defaultSlug) redirect({ href: `/f/${defaultSlug}`, locale });

  const t = await getTranslations("Home");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
        <h1 className="font-heading text-4xl font-semibold tracking-tight text-balance">
          {t("headline")}
        </h1>
        <p className="text-lg text-muted-foreground">{t("subheadline")}</p>
        <p className="text-muted-foreground">{t("noFarm")}</p>
      </main>
    </>
  );
}
