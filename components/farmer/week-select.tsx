"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { usePathname, useRouter } from "@/i18n/navigation";

type WeekSelectProps = {
  value: string;
  weeks: { id: string; label: string }[];
  /** Other query params to keep (e.g. tab). */
  keep?: Record<string, string>;
};

export function WeekSelect({ value, weeks, keep = {} }: WeekSelectProps) {
  const t = useTranslations("FarmOrders");
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="week-select" className="text-sm text-muted-foreground">
        {t("week")}
      </Label>
      <select
        id="week-select"
        value={value}
        onChange={(e) =>
          router.push(
            `${pathname}?${new URLSearchParams({ ...keep, week: e.target.value })}`,
          )
        }
        className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
      >
        {weeks.map((w) => (
          <option key={w.id} value={w.id}>
            {w.label}
          </option>
        ))}
      </select>
    </div>
  );
}
