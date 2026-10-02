import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductForm } from "@/components/farmer/product-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { getUnits } from "@/lib/farm/queries";

export default async function NewProductPage({
  params,
}: PageProps<"/[locale]/farm/products/new">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  await requireFarmer();
  const [units, t] = await Promise.all([
    getUnits(),
    getTranslations("FarmProducts"),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/farm/products"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← {t("back")}
      </Link>
      <h1 className="mt-3 mb-6 font-heading text-3xl font-semibold">
        {t("new")}
      </h1>
      <ProductForm units={units} />
    </main>
  );
}
