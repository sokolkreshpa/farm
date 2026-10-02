"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

// Shown when a page throws (e.g. a database error, D-55). No details leak to
// the user; the digest helps match server logs.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("ErrorPage");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-6 py-16">
      <h1 className="font-heading text-3xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("body")}</p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={reset}>
          {t("retry")}
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/">{t("home")}</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          {t("reference", { digest: error.digest })}
        </p>
      )}
    </main>
  );
}
