import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import type { Locale } from "@/i18n/routing";
import { getPublicTenant } from "@/lib/tenants/queries";

// Phase 4 turns this into the weekly shop (products, cart, last order).
export default async function FarmPage({
  params,
}: PageProps<"/[locale]/f/[slug]">) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();
  const t = await getTranslations("Farm");

  return (
    <>
      <SiteHeader title={tenant.name} homeHref={`/f/${tenant.slug}`} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {tenant.name}
        </h1>
        {tenant.description && (
          <p className="mt-3 max-w-2xl text-lg text-muted-foreground">
            {tenant.description}
          </p>
        )}
        <p className="mt-8 text-muted-foreground">{t("comingSoon")}</p>
      </main>
    </>
  );
}
