"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "@/i18n/navigation";
import {
  closeWeek,
  deleteDraftWeek,
  publishWeek,
  updateWeekSettings,
  type FarmFormState,
} from "@/lib/farm/actions";
import type { CycleStatus } from "@/lib/farm/queries";
import type { ErrorKey } from "@/lib/i18n/errors";

type WeekControlsProps = {
  cycleId: string;
  status: CycleStatus;
  /** datetime-local value in the farm's timezone. */
  deadlineInput: string;
  deadlineLabel: string;
  message: string;
};

export function WeekControls({
  cycleId,
  status,
  deadlineInput,
  deadlineLabel,
  message,
}: WeekControlsProps) {
  const t = useTranslations("Week");
  const tErr = useTranslations("Errors");
  const router = useRouter();
  const [state, action, saving] = useActionState<FarmFormState, FormData>(
    updateWeekSettings,
    {},
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);
  const closed = status === "CLOSED";

  function run(
    fn: () => Promise<{ ok: boolean; error?: ErrorKey } | undefined>,
    confirmText: string,
  ) {
    if (!window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result && !result.ok && result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="grid gap-4">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="cycleId" value={cycleId} />
        <div className="grid gap-1">
          <Label htmlFor="deadline">{t("deadline")}</Label>
          <Input
            id="deadline"
            name="deadline"
            type="datetime-local"
            defaultValue={deadlineInput}
            disabled={closed}
            className="h-11 text-base"
          />
        </div>
        <div className="grid min-w-56 flex-1 gap-1">
          <Label htmlFor="message">{t("message")}</Label>
          <Input
            id="message"
            name="message"
            defaultValue={message}
            maxLength={500}
            placeholder={t("messagePlaceholder")}
            disabled={closed}
            className="h-11 text-base"
          />
        </div>
        {!closed && (
          <Button
            type="submit"
            variant="outline"
            size="lg"
            className="h-11"
            disabled={saving}
          >
            {t("save")}
          </Button>
        )}
        {state.success && (
          <span role="status" className="text-sm text-primary">
            {t("saved")}
          </span>
        )}
      </form>
      {(state.error || state.fields?.deadline) && (
        <p role="alert" className="text-sm text-destructive">
          {tErr(state.error ?? state.fields!.deadline!)}
        </p>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(error)}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap gap-3">
        {status !== "PUBLISHED" && !closed && (
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={pending}
            onClick={() =>
              run(
                () => publishWeek(cycleId),
                t("publishConfirm", { deadline: deadlineLabel }),
              )
            }
          >
            {t("publish")}
          </Button>
        )}
        {status === "PUBLISHED" && (
          <Button
            variant="outline"
            size="lg"
            className="h-12"
            disabled={pending}
            onClick={() => run(() => closeWeek(cycleId), t("closeConfirm"))}
          >
            {t("close")}
          </Button>
        )}
        {status === "DRAFT" && (
          <Button
            variant="ghost"
            size="lg"
            className="h-12 text-destructive"
            disabled={pending}
            onClick={() =>
              run(() => deleteDraftWeek(cycleId), t("deleteConfirm"))
            }
          >
            {t("delete")}
          </Button>
        )}
      </div>
    </div>
  );
}
