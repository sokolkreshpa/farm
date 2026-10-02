"use client";

import { Copy, FilePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { createWeek } from "@/lib/farm/actions";
import type { ErrorKey } from "@/lib/i18n/errors";

type PrepareWeekProps = {
  weekStart: string;
  title: string;
  sourceCycleId: string | null;
};

/** "Prepare week X": copy last week (primary) or start empty. */
export function PrepareWeek({
  weekStart,
  title,
  sourceCycleId,
}: PrepareWeekProps) {
  const t = useTranslations("Week");
  const tErr = useTranslations("Errors");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  function create(source: string | null) {
    setError(null);
    startTransition(async () => {
      const result = await createWeek(weekStart, source);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="font-heading text-2xl font-semibold">{title}</h2>
      <p className="mt-2 text-muted-foreground">{t("prepareBody")}</p>
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{tErr(error)}</AlertDescription>
        </Alert>
      )}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        {sourceCycleId && (
          <Button
            size="lg"
            className="h-14 text-base"
            disabled={pending}
            onClick={() => create(sourceCycleId)}
          >
            <Copy aria-hidden />
            {t("copyLast")}
          </Button>
        )}
        <Button
          size="lg"
          variant={sourceCycleId ? "outline" : "default"}
          className="h-14 text-base"
          disabled={pending}
          onClick={() => create(null)}
        >
          <FilePlus aria-hidden />
          {t("startEmpty")}
        </Button>
      </div>
    </section>
  );
}
