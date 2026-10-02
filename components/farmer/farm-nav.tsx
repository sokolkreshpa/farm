"use client";

import {
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/farm", key: "dashboard", icon: LayoutDashboard, exact: true },
  {
    href: "/farm/week",
    key: "week",
    icon: CalendarDays,
    match: ["/farm/week", "/farm/weeks"],
  },
  { href: "/farm/orders", key: "orders", icon: ClipboardList },
  { href: "/farm/products", key: "products", icon: Package },
  { href: "/farm/customers", key: "customers", icon: Users },
  { href: "/farm/settings", key: "settings", icon: Settings },
] as const;

export function FarmNav() {
  const t = useTranslations("FarmNav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="border-b border-border bg-background print:hidden"
    >
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-2">
        {ITEMS.map((item) => {
          const prefixes = "match" in item ? item.match : [item.href];
          const active =
            "exact" in item
              ? pathname === item.href
              : prefixes.some(
                  (p) => pathname === p || pathname.startsWith(`${p}/`),
                );
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(item.key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
