import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function RegisterPage({
  params,
  searchParams,
}: PageProps<"/[locale]/register">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  const farm = typeof query.farm === "string" ? query.farm : undefined;
  const t = await getTranslations("Auth");

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  return (
    <AuthCard
      title={t("register.title")}
      description={t("register.subtitle")}
      footer={
        <span>
          {t("register.haveAccount")}{" "}
          <Link href={loginHref} className="font-medium text-primary">
            {t("register.loginLink")}
          </Link>
        </span>
      }
    >
      <RegisterForm farm={farm} next={next ?? undefined} />
    </AuthCard>
  );
}
