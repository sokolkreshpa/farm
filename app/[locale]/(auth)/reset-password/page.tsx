import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { homePathForRole } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/dal/session";

// Reached from the recovery / invite e-mail link: /api/auth/confirm has
// already exchanged the token for a session.
export default async function ResetPasswordPage({
  params,
}: PageProps<"/[locale]/reset-password">) {
  const { locale } = (await params) as { locale: Locale };
  setRequestLocale(locale);
  const [t, viewer] = await Promise.all([getTranslations("Auth"), getViewer()]);

  if (!viewer) {
    return (
      <AuthCard
        title={t("reset.expiredTitle")}
        description={t("reset.expiredBody")}
      >
        <Button asChild size="lg" className="h-11 w-full text-base">
          <Link href="/forgot-password">{t("reset.requestNew")}</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("reset.title")}>
      <ResetPasswordForm continueHref={homePathForRole(viewer.role)} />
    </AuthCard>
  );
}
