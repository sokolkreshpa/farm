import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";

export default async function ForgotPasswordPage({
  params,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const t = await getTranslations("Auth");

  return (
    <AuthCard
      title={t("forgot.title")}
      description={t("forgot.subtitle")}
      footer={
        <Link href="/login" className="font-medium text-primary">
          {t("forgot.backToLogin")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
