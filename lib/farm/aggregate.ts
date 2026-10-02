import type { Database } from "@/types/database";

type OrderStatus = Database["public"]["Enums"]["order_status"];

export type AggregatableOrder = {
  status: OrderStatus;
  total: number;
  lines: {
    productId: string;
    name: string;
    unitCode: string;
    quantity: number;
    total: number;
  }[];
};

export type ProductTotal = {
  productId: string;
  name: string;
  unitCode: string;
  quantity: number;
  orderCount: number;
  amount: number;
};

export type WeekTotals = {
  products: ProductTotal[];
  orderCount: number;
  amount: number;
};

/** Statuses that still need preparing (default for the totals view). */
export const ACTIVE_STATUSES: OrderStatus[] = [
  "PLACED",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "DELIVERED",
];

/**
 * "How much do I need to prepare?" (spec §15A): quantities per product across
 * orders with the given statuses. Cancelled orders never count.
 */
export function aggregateTotals(
  orders: AggregatableOrder[],
  statuses: OrderStatus[] = ACTIVE_STATUSES,
): WeekTotals {
  const included = orders.filter(
    (o) => o.status !== "CANCELLED" && statuses.includes(o.status),
  );
  const byProduct = new Map<string, ProductTotal>();

  for (const order of included) {
    const seen = new Set<string>();
    for (const line of order.lines) {
      const total = byProduct.get(line.productId) ?? {
        productId: line.productId,
        name: line.name,
        unitCode: line.unitCode,
        quantity: 0,
        orderCount: 0,
        amount: 0,
      };
      total.quantity = Number((total.quantity + line.quantity).toFixed(3));
      total.amount = Math.round((total.amount + line.total) * 100) / 100;
      if (!seen.has(line.productId)) {
        total.orderCount += 1;
        seen.add(line.productId);
      }
      byProduct.set(line.productId, total);
    }
  }

  return {
    products: [...byProduct.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    orderCount: included.length,
    amount:
      Math.round(included.reduce((sum, o) => sum + o.total, 0) * 100) / 100,
  };
}

/** The next status for the farmer's one-tap button, or null if final. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const flow: Partial<Record<OrderStatus, OrderStatus>> = {
    PLACED: "CONFIRMED",
    CONFIRMED: "PREPARING",
    PREPARING: "READY",
    READY: "DELIVERED",
  };
  return flow[status] ?? null;
}

export function isFinalStatus(status: OrderStatus): boolean {
  return status === "DELIVERED" || status === "CANCELLED";
}
