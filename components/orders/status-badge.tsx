import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const STYLES: Record<OrderStatus, string> = {
  PLACED: "bg-[oklch(0.94_0.05_85)] text-[oklch(0.42_0.08_70)]",
  CONFIRMED: "bg-[oklch(0.93_0.04_250)] text-[oklch(0.4_0.08_255)]",
  PREPARING: "bg-[oklch(0.93_0.05_55)] text-[oklch(0.45_0.1_50)]",
  READY: "bg-[oklch(0.92_0.06_145)] text-[oklch(0.38_0.09_145)]",
  DELIVERED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
};

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  const t = useTranslations("OrderStatus");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[status],
        className,
      )}
    >
      {t(status)}
    </span>
  );
}
