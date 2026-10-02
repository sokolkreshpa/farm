import { Mail, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CustomerForm } from "@/components/farmer/customer-form";
import { StatusBadge } from "@/components/orders/status-badge";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import {
  getCustomerOrders,
  getCustomers,
  getFarmSettings,
} from "@/lib/farm/queries";
import { formatMoney } from "@/lib/format";
import { getDateFormatters } from "@/lib/i18n/dates";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function FarmCustomerPage({
  params,
}: PageProps<"/[locale]/farm/customers/[id]">) {
  const { locale, id } = (await params) as { locale: Locale; id: string };
  setRequestLocale(locale);
  if (!UUID.test(id)) notFound();
  const { tenant } = await requireFarmer();

  const [settings, customers, orders, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getCustomers(tenant.id),
    getCustomerOrders(tenant.id, id),
    getTranslations("FarmCustomers"),
  ]);
  const customer = customers.find((c) => c.id === id);
  if (!customer) notFound();
  const dates = await getDateFormatters(settings.timezone);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/farm/customers"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← {t("back")}
      </Link>
      <h1 className="mt-3 font-heading text-3xl font-semibold">
        {customer.firstName} {customer.lastName}
      </h1>
      <div className="mt-2 flex flex-wrap gap-4 text-sm">
        {customer.phone && (
          <a
            href={`tel:${customer.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center gap-1.5 text-primary"
          >
            <Phone className="size-4" aria-hidden /> {customer.phone}
          </a>
        )}
        <a
          href={`mailto:${customer.email}`}
          className="inline-flex items-center gap-1.5 text-primary"
        >
          <Mail className="size-4" aria-hidden /> {customer.email}
        </a>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("orders", { count: customer.orderCount })} ·{" "}
        {t("spent", {
          total: formatMoney(customer.totalSpent, settings.currency, locale),
        })}
      </p>

      <section className="mt-6 rounded-2xl border border-border bg-card p-4">
        <CustomerForm
          customerId={customer.id}
          farmerNotes={customer.farmerNotes ?? ""}
          active={customer.active}
        />
      </section>

      <section className="mt-8">
        <h2 className="font-heading text-xl font-semibold">
          {t("orderHistory")}
        </h2>
        {orders.length === 0 ? (
          <p className="mt-2 text-muted-foreground">{t("noOrders")}</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {orders.map((o) => (
              <li key={o.id}>
                <Link
                  href={`/farm/orders/${o.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 hover:bg-muted/50"
                >
                  <span>
                    <span className="block font-medium">#{o.orderNumber}</span>
                    <span className="block text-sm text-muted-foreground">
                      {dates.date(o.placedAt)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <StatusBadge status={o.status} />
                    <span className="font-semibold tabular-nums">
                      {formatMoney(o.total, o.currency, locale)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
