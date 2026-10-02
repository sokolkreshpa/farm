import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type CycleStatus = Database["public"]["Enums"]["cycle_status"];

const STYLES: Record<CycleStatus, string> = {
  DRAFT: "bg-[oklch(0.94_0.05_85)] text-[oklch(0.42_0.08_70)]",
  PUBLISHED: "bg-[oklch(0.92_0.06_145)] text-[oklch(0.38_0.09_145)]",
  CLOSED: "bg-muted text-muted-foreground",
};

export function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const t = useTranslations("CycleStatus");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[status],
      )}
    >
      {t(status)}
    </span>
  );
}
