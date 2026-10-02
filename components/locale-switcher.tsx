"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function LocaleSwitcher() {
  const t = useTranslations("LocaleSwitcher");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    // Keep the query string (e.g. ?next=...) when switching language.
    const search = window.location.search;
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      className="flex rounded-full border border-border p-0.5 text-xs"
    >
      {routing.locales.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          disabled={isPending}
          aria-pressed={code === locale}
          onClick={() => code !== locale && switchTo(code)}
          className={cn(
            "rounded-full px-2.5 py-1 font-medium transition-colors",
            code === locale
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {code.toUpperCase()}
          <span className="sr-only"> {t(code)}</span>
        </button>
      ))}
    </div>
  );
}
