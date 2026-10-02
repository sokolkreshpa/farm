import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function LoginPage({
  params,
  searchParams,
}: PageProps<"/[locale]/login">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const query = await searchParams;
  const next = safeNextPath(typeof query.next === "string" ? query.next : null);
  const t = await getTranslations("Auth");

  const registerHref = next
    ? `/register?next=${encodeURIComponent(next)}`
    : "/register";

  return (
    <AuthCard
      title={t("login.title")}
      description={t("login.subtitle")}
      footer={
        <span>
          {t("login.noAccount")}{" "}
          <Link href={registerHref} className="font-medium text-primary">
            {t("login.registerLink")}
          </Link>
        </span>
      }
    >
      {query.error === "link" && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{t("login.linkError")}</AlertDescription>
        </Alert>
      )}
      <LoginForm next={next ?? undefined} />
    </AuthCard>
  );
}
