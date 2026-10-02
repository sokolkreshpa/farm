"use client";

import { Truck, Warehouse } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { StatusBadge } from "@/components/orders/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { bulkSetOrderStatus } from "@/lib/farm/actions";
import { formatMoney } from "@/lib/format";
import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export type OrderListItem = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  deliveryMethod: "DELIVERY" | "PICKUP";
  customerName: string;
  customerPhone: string;
  total: number;
  currency: string;
  placedAt: string; // formatted
  summary: string;
};

const FILTERS: (OrderStatus | "ALL")[] = [
  "ALL",
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
];

export function OrdersList({ orders }: { orders: OrderListItem[] }) {
  const t = useTranslations("FarmOrders");
  const tStatus = useTranslations("OrderStatus");
  const locale = useLocale();
  const router = useRouter();
  const [filter, setFilter] = useState<OrderStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter(
      (o) =>
        (filter === "ALL" || o.status === filter) &&
        (!q ||
          o.customerName.toLowerCase().includes(q) ||
          String(o.orderNumber).includes(q) ||
          o.customerPhone.replace(/\s/g, "").includes(q.replace(/\s/g, ""))),
    );
  }, [orders, filter, query]);

  const counts = useMemo(() => {
    const map = new Map<string, number>([["ALL", orders.length]]);
    for (const o of orders) map.set(o.status, (map.get(o.status) ?? 0) + 1);
    return map;
  }, [orders]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulk(status: OrderStatus) {
    setMessage(null);
    startTransition(async () => {
      const result = await bulkSetOrderStatus([...selected], status);
      setSelected(new Set());
      setMessage(
        [
          result.updated ? t("bulkDone", { updated: result.updated }) : "",
          result.failed ? t("bulkFailed", { failed: result.failed }) : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      router.refresh();
    });
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((o) => selected.has(o.id));

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
      <div className="flex gap-2 overflow-x-auto pb-1" role="group">
        {FILTERS.filter((f) => f === "ALL" || counts.get(f)).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "rounded-full bg-primary px-3 py-1.5 text-sm whitespace-nowrap text-primary-foreground"
                : "rounded-full bg-muted px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground"
            }
          >
            {f === "ALL" ? t("all") : tStatus(f)} ({counts.get(f) ?? 0})
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-muted/50 px-3 py-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={allVisibleSelected}
            onCheckedChange={(checked) =>
              setSelected(
                checked === true
                  ? new Set(visible.map((o) => o.id))
                  : new Set(),
              )
            }
          />
          {selected.size > 0
            ? t("selected", { count: selected.size })
            : t("selectAll")}
        </label>
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => bulk("CONFIRMED")}
            >
              {t("bulkConfirm")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => bulk("DELIVERED")}
            >
              {t("bulkDeliver")}
            </Button>
          </div>
        )}
        {message && (
          <span role="status" className="text-sm text-primary">
            {message}
          </span>
        )}
      </div>

      {visible.length === 0 ? (
        <p className="text-muted-foreground">{t("noOrders")}</p>
      ) : (
        <ul className="grid gap-2">
          {visible.map((order) => (
            <li
              key={order.id}
              className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
            >
              <Checkbox
                checked={selected.has(order.id)}
                onCheckedChange={() => toggle(order.id)}
                aria-label={t("select", { number: order.orderNumber })}
                className="mt-1 size-5"
              />
              <Link
                href={`/farm/orders/${order.id}`}
                className="min-w-0 flex-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    #{order.orderNumber} · {order.customerName}
                  </span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {order.summary}
                </p>
                <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    {order.deliveryMethod === "DELIVERY" ? (
                      <Truck className="size-4" aria-hidden />
                    ) : (
                      <Warehouse className="size-4" aria-hidden />
                    )}
                    {order.placedAt}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatMoney(order.total, order.currency, locale)}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
