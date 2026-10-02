import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { CheckoutForm } from "@/components/checkout/checkout-form";
import { SiteHeader } from "@/components/site-header";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { getOpenOffer } from "@/lib/catalog/queries";
import { requireViewer } from "@/lib/dal/session";
import { createClient } from "@/lib/supabase/server";
import { getPublicTenant } from "@/lib/tenants/queries";

export default async function CheckoutPage({
  params,
}: PageProps<"/[locale]/f/[slug]/checkout">) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const viewer = await requireViewer(`/f/${slug}/checkout`);
  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const supabase = await createClient();
  const [offer, t, format, { data: addresses }] = await Promise.all([
    getOpenOffer(tenant),
    getTranslations("Checkout"),
    getFormatter(),
    supabase
      .from("addresses")
      .select("id, label, address_line, city, notes, is_default")
      .eq("profile_id", viewer.id)
      .order("is_default", { ascending: false })
      .order("created_at"),
  ]);

  return (
    <>
      <SiteHeader title={tenant.name} homeHref={`/f/${tenant.slug}`} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Link
          href={`/f/${tenant.slug}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          ← {t("backToShop")}
        </Link>
        <h1 className="mt-3 font-heading text-3xl font-semibold">
          {t("title")}
        </h1>

        {!offer || !offer.isOpen ? (
          <p className="mt-6 rounded-xl bg-muted px-4 py-3">{t("closed")}</p>
        ) : (
          <>
            <p className="mt-1 text-muted-foreground">
              {t("deadline", {
                deadline: format.dateTime(new Date(offer.deadline), {
                  timeZone: tenant.timezone,
                  weekday: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                  hourCycle: "h23",
                }),
              })}
            </p>
            <CheckoutForm
              slug={tenant.slug}
              offer={offer}
              deliveryEnabled={tenant.deliveryEnabled}
              pickupEnabled={tenant.pickupEnabled}
              deliveryFee={tenant.deliveryFee}
              deliveryInformation={tenant.deliveryInformation}
              pickupInformation={tenant.pickupInformation}
              defaultPhone={viewer.phone ?? ""}
              addresses={(addresses ?? []).map((a) => ({
                id: a.id,
                label: a.label,
                addressLine: a.address_line,
                city: a.city,
                notes: a.notes,
                isDefault: a.is_default,
              }))}
            />
          </>
        )}
      </main>
    </>
  );
}
