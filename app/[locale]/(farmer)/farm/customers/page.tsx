import { getTranslations, setRequestLocale } from "next-intl/server";
import { CustomersList } from "@/components/farmer/customers-list";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getCustomers, getFarmSettings } from "@/lib/farm/queries";
import { getDateFormatters } from "@/lib/i18n/dates";

export default async function FarmCustomersPage({
  params,
}: PageProps<"/[locale]/farm/customers">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const [settings, customers, t] = await Promise.all([
    getFarmSettings(tenant.id),
    getCustomers(tenant.id),
    getTranslations("FarmCustomers"),
  ]);
  const dates = await getDateFormatters(settings.timezone);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="mb-6 font-heading text-3xl font-semibold">
        {t("title")}{" "}
        <span className="text-muted-foreground">({customers.length})</span>
      </h1>
      {customers.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <CustomersList
          customers={customers.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName}`.trim(),
            phone: c.phone,
            email: c.email,
            active: c.active,
            orderCount: c.orderCount,
            lastOrder: c.lastOrderAt ? dates.date(c.lastOrderAt) : null,
          }))}
        />
      )}
    </main>
  );
}
