import {
  CalendarClock,
  Mail,
  MapPin,
  Phone,
  Truck,
  Warehouse,
} from "lucide-react";
import type { Metadata } from "next";
import type { DateTimeFormatOptions } from "next-intl";
import { notFound } from "next/navigation";
import {
  getFormatter,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { CartBar } from "@/components/shop/cart-bar";
import { ProductGrid } from "@/components/shop/product-grid";
import { RepeatOrderCard } from "@/components/shop/repeat-order-card";
import type { Locale } from "@/i18n/routing";
import { getOpenOffer } from "@/lib/catalog/queries";
import { getViewer } from "@/lib/dal/session";
import { formatMoney } from "@/lib/format";
import { getLastOrderAtFarm, getMyOrder } from "@/lib/orders/queries";
import { buildRepeatCart } from "@/lib/orders/repeat";
import { getPublicTenant } from "@/lib/tenants/queries";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await getPublicTenant(slug);
  return tenant
    ? { title: tenant.name, description: tenant.description ?? undefined }
    : {};
}

const UUID = /^[0-9a-f-]{36}$/i;

// The farm's public page and weekly shop in one (spec §11, §18).
export default async function FarmPage({
  params,
  searchParams,
}: PageProps<"/[locale]/f/[slug]">) {
  const { locale, slug } = (await params) as { locale: Locale; slug: string };
  setRequestLocale(locale);

  const tenant = await getPublicTenant(slug);
  if (!tenant) notFound();

  const query = await searchParams;
  const repeatId =
    typeof query.repeat === "string" && UUID.test(query.repeat)
      ? query.repeat
      : null;

  const [offer, viewer, t, format] = await Promise.all([
    getOpenOffer(tenant),
    getViewer(),
    getTranslations("Shop"),
    getFormatter(),
  ]);

  // "Repeat" from order history, or the last order at this farm.
  const pastOrder = viewer
    ? repeatId
      ? await getMyOrder(viewer.id, repeatId)
      : await getLastOrderAtFarm(viewer.id, tenant.id)
    : null;
  const repeatOrder = pastOrder?.farm.slug === tenant.slug ? pastOrder : null;

  const dateInZone = (iso: string, options: DateTimeFormatOptions) =>
    format.dateTime(new Date(iso), { timeZone: tenant.timezone, ...options });
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  return (
    <>
      <SiteHeader title={tenant.name} homeHref={`/f/${tenant.slug}`} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-10">
        <section className="py-8 sm:py-12">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("thisWeek")}
          </h1>
          {offer && (
            <div className="mt-3 flex flex-col gap-1 text-muted-foreground sm:flex-row sm:items-center sm:gap-4">
              <span>
                {t("week", {
                  start: day(offer.weekStart),
                  end: day(offer.weekEnd),
                })}
              </span>
              {offer.isOpen && (
                <span className="inline-flex items-center gap-1.5 font-medium text-primary">
                  <CalendarClock className="size-4" aria-hidden />
                  {t("ordersClose", {
                    deadline: dateInZone(offer.deadline, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                      hourCycle: "h23",
                    }),
                  })}
                </span>
              )}
            </div>
          )}
          {offer?.message && (
            <p className="mt-4 rounded-xl bg-secondary px-4 py-3 text-secondary-foreground">
              {offer.message}
            </p>
          )}
        </section>

        {repeatOrder && (
          <div className="mb-8">
            <RepeatOrderCard
              slug={tenant.slug}
              cycleId={offer?.isOpen ? offer.cycleId : null}
              currency={tenant.currency}
              orderNumber={repeatOrder.orderNumber}
              placedOn={dateInZone(repeatOrder.placedAt, {
                day: "numeric",
                month: "long",
              })}
              lines={buildRepeatCart(repeatOrder.lines, offer)}
              highlighted={repeatId !== null}
            />
          </div>
        )}

        {offer && !offer.isOpen && (
          <Notice title={t("closedTitle")} body={t("closedBody")} />
        )}
        {!offer && <Notice title={t("noWeekTitle")} body={t("noWeekBody")} />}

        {offer && offer.items.length > 0 && (
          <ProductGrid slug={tenant.slug} offer={offer} />
        )}

        <div className="mt-14 grid gap-10 sm:grid-cols-2">
          <section>
            <h2 className="font-heading text-2xl font-semibold">
              {t("howItWorks")}
            </h2>
            <ol className="mt-4 grid gap-3">
              {(["step1", "step2", "step3"] as const).map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span className="pt-0.5">{t(step)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-semibold">
              {t("aboutFarm")}
            </h2>
            {tenant.description && (
              <p className="mt-4 leading-relaxed text-muted-foreground">
                {tenant.description}
              </p>
            )}
            <dl className="mt-4 grid gap-3 text-sm">
              {tenant.deliveryEnabled && tenant.deliveryInformation && (
                <InfoRow
                  icon={<Truck className="size-4" aria-hidden />}
                  title={t("deliveryInfo")}
                >
                  {tenant.deliveryInformation}{" "}
                  {t("deliveryFee", {
                    fee: formatMoney(
                      tenant.deliveryFee,
                      tenant.currency,
                      locale,
                    ),
                  })}
                </InfoRow>
              )}
              {tenant.pickupEnabled && tenant.pickupInformation && (
                <InfoRow
                  icon={<Warehouse className="size-4" aria-hidden />}
                  title={t("pickupInfo")}
                >
                  {tenant.pickupInformation}
                </InfoRow>
              )}
              {tenant.address && (
                <InfoRow
                  icon={<MapPin className="size-4" aria-hidden />}
                  title={t("contact")}
                >
                  {tenant.address}
                </InfoRow>
              )}
              {tenant.phone && (
                <InfoRow icon={<Phone className="size-4" aria-hidden />}>
                  <a
                    href={`tel:${tenant.phone.replace(/\s/g, "")}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {tenant.phone}
                  </a>
                </InfoRow>
              )}
              {tenant.email && (
                <InfoRow icon={<Mail className="size-4" aria-hidden />}>
                  <a
                    href={`mailto:${tenant.email}`}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    {tenant.email}
                  </a>
                </InfoRow>
              )}
            </dl>
          </section>
        </div>
      </main>

      {offer && (
        <CartBar
          slug={tenant.slug}
          offer={offer}
          isLoggedIn={viewer !== null}
        />
      )}
    </>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-8 rounded-2xl border border-dashed border-border bg-muted/50 px-5 py-6">
      <p className="font-heading text-lg font-semibold">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
    </div>
  );
}

function InfoRow({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div>
        {title && <dt className="font-medium">{title}</dt>}
        <dd className="text-muted-foreground">{children}</dd>
      </div>
    </div>
  );
}
