"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import { isFinalStatus, nextStatus } from "@/lib/farm/aggregate";
import { setOrderStatus } from "@/lib/farm/actions";
import type { ErrorKey } from "@/lib/i18n/errors";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const FLOW: OrderStatus[] = ["CONFIRMED", "PREPARING", "READY", "DELIVERED"];

/** One big "next step" button, a way to jump ahead, and cancel. */
export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: OrderStatus;
}) {
  const t = useTranslations("FarmOrders");
  const tStatus = useTranslations("OrderStatus");
  const tErr = useTranslations("Errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<ErrorKey | null>(null);

  if (isFinalStatus(status)) return null;
  const next = nextStatus(status);
  const later = FLOW.filter(
    (s) => FLOW.indexOf(s) > FLOW.indexOf(next ?? "DELIVERED"),
  );

  function change(target: OrderStatus, note?: string) {
    setError(null);
    startTransition(async () => {
      const result = await setOrderStatus(orderId, target, note);
      if (result.ok) router.refresh();
      else setError(result.error);
    });
  }

  return (
    <div className="grid gap-3 print:hidden">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{tErr(error)}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {next && (
          <Button
            size="lg"
            className="h-14 text-base"
            disabled={pending}
            onClick={() => change(next)}
          >
            {t("markAs", { status: tStatus(next) })}
          </Button>
        )}
        {later.map((s) => (
          <Button
            key={s}
            variant="outline"
            disabled={pending}
            onClick={() => change(s)}
          >
            {tStatus(s)}
          </Button>
        ))}
        <Button
          variant="ghost"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t("cancelConfirm"))) return;
            const reason = window.prompt(t("cancelReason")) ?? undefined;
            change("CANCELLED", reason || undefined);
          }}
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
