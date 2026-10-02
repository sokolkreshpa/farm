"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  active: boolean;
  orderCount: number;
  lastOrder: string | null; // formatted
};

export function CustomersList({
  customers,
}: {
  customers: CustomerListItem[];
}) {
  const t = useTranslations("FarmCustomers");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      [c.name, c.email, c.phone ?? ""].some((v) =>
        v.toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, "")),
      ),
    );
  }, [customers, query]);

  return (
    <div className="grid gap-4">
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("search")}
        aria-label={t("search")}
        className="h-11 text-base"
      />
      <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
        {visible.map((c) => (
          <li key={c.id}>
            <Link
              href={`/farm/customers/${c.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
            >
              <span className="min-w-0">
                <span className="block font-medium">
                  {c.name}
                  {!c.active && (
                    <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                      {t("inactive")}
                    </span>
                  )}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {[c.phone, c.email].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm">
                <span className="block font-medium">
                  {t("orders", { count: c.orderCount })}
                </span>
                <span className="block text-muted-foreground">
                  {c.lastOrder
                    ? t("lastOrder", { date: c.lastOrder })
                    : t("noOrders")}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
