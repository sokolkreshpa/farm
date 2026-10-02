import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProductImage } from "@/components/products/product-image";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requireFarmer } from "@/lib/dal/session";
import { setProductActive } from "@/lib/farm/actions";
import { getProducts } from "@/lib/farm/queries";
import { cn } from "@/lib/utils";

export default async function FarmProductsPage({
  params,
}: PageProps<"/[locale]/farm/products">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const { tenant } = await requireFarmer();
  const [products, t, tUnits] = await Promise.all([
    getProducts(tenant.id),
    getTranslations("FarmProducts"),
    getTranslations("Units"),
  ]);
  const unit = (code: string) =>
    tUnits.has(code as never) ? tUnits(code as never) : code;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
        <Button asChild size="lg">
          <Link href="/farm/products/new">
            <Plus aria-hidden /> {t("new")}
          </Link>
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="mt-6 text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-2">
          {products.map((product) => (
            <li
              key={product.id}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-card p-3",
                !product.active && "opacity-60",
              )}
            >
              <ProductImage
                name={product.name}
                imageUrl={product.imageUrl}
                className="size-14 shrink-0"
                sizes="56px"
              />
              <Link
                href={`/farm/products/${product.id}`}
                className="min-w-0 flex-1"
              >
                <p className="font-medium">{product.name}</p>
                <p className="text-sm text-muted-foreground">
                  {[product.category, unit(product.unitCode)]
                    .filter(Boolean)
                    .join(" · ")}
                  {!product.active && ` · ${t("archived")}`}
                </p>
              </Link>
              <form
                action={setProductActive.bind(
                  null,
                  product.id,
                  !product.active,
                )}
              >
                <Button type="submit" variant="ghost" size="sm">
                  {product.active ? t("archive") : t("restore")}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
