import { getTranslations, setRequestLocale } from "next-intl/server";
import { NewFarmForm } from "@/components/admin/new-farm-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { requirePlatformAdmin } from "@/lib/dal/session";

export default async function NewFarmPage({
  params,
}: PageProps<"/[locale]/admin/farms/new">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  await requirePlatformAdmin();
  const t = await getTranslations("Admin");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
      <Link
        href="/admin"
        className="text-sm text-primary underline-offset-4 hover:underline"
      >
        ← {t("back")}
      </Link>
      <h1 className="mt-3 mb-6 font-heading text-3xl font-semibold">
        {t("newFarm")}
      </h1>
      <NewFarmForm />
    </main>
  );
}
