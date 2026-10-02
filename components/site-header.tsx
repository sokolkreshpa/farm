import { Sprout } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { Link } from "@/i18n/navigation";
import { getViewer } from "@/lib/dal/session";

type SiteHeaderProps = {
  /** Brand shown on the left; defaults to the platform name. */
  title?: string;
  homeHref?: string;
};

export async function SiteHeader({ title, homeHref = "/" }: SiteHeaderProps) {
  const [t, tMeta, viewer] = await Promise.all([
    getTranslations("Nav"),
    getTranslations("Metadata"),
    getViewer(),
  ]);

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link
          href={homeHref}
          className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold"
        >
          <Sprout className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{title ?? tMeta("title")}</span>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <LocaleSwitcher />
          {viewer ? (
            <UserMenu name={viewer.firstName} role={viewer.role} />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link href="/login">{t("login")}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
