import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";

// Phase 4: order history with "Repeat".
export default async function OrdersPage({
  params,
}: PageProps<"/[locale]/account/orders">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [tNav, t] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Account"),
  ]);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="font-heading text-3xl font-semibold">
        {tNav("myOrders")}
      </h1>
      <p className="mt-6 text-muted-foreground">{t("comingSoon")}</p>
    </main>
  );
}
