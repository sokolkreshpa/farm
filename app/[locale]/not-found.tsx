import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <Link href="/" className="text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
