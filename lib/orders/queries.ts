import "server-only";
import { cache } from "react";
import type { PastOrderLine } from "@/lib/orders/repeat";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type DeliveryMethod = Database["public"]["Enums"]["delivery_method"];

export type OrderLine = PastOrderLine & {
  id: string;
  total: number;
};

export type CustomerOrder = {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  placedAt: string;
  deliveryMethod: DeliveryMethod;
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  farm: { name: string; slug: string; phone: string | null };
  week: { start: string; end: string };
  lines: OrderLine[];
};

// Queries throw on database errors (rendered by the error boundary) instead of
// silently returning nothing.
// Customer-side queries always filter by the viewer's own customer records:
// a farmer browsing their own shop must not see other customers' orders here.
const ORDER_SELECT = `
  id, order_number, status, placed_at, delivery_method, subtotal, delivery_fee,
  total, currency, customer_name, customer_phone, delivery_address,
  delivery_city, delivery_notes, notes,
  customers!inner ( profile_id ),
  weekly_cycles ( week_start, week_end, tenants ( name, slug, phone ) ),
  order_items ( id, product_id, product_name_snapshot, unit_snapshot, quantity, unit_price, total_price )
`;

type OrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  placed_at: string;
  delivery_method: DeliveryMethod;
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  notes: string | null;
  weekly_cycles: {
    week_start: string;
    week_end: string | null;
    tenants: { name: string; slug: string; phone: string | null } | null;
  } | null;
  order_items: {
    id: string;
    product_id: string;
    product_name_snapshot: string;
    unit_snapshot: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
};

function toOrder(row: OrderRow): CustomerOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    placedAt: row.placed_at,
    deliveryMethod: row.delivery_method,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    currency: row.currency,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    deliveryNotes: row.delivery_notes,
    notes: row.notes,
    farm: row.weekly_cycles?.tenants ?? { name: "", slug: "", phone: null },
    week: {
      start: row.weekly_cycles?.week_start ?? "",
      end: row.weekly_cycles?.week_end ?? "",
    },
    lines: row.order_items
      .map((item) => ({
        id: item.id,
        productId: item.product_id,
        name: item.product_name_snapshot,
        unitCode: item.unit_snapshot,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unit_price),
        total: Number(item.total_price),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** All orders of the viewer across farms, newest first. */
export const getMyOrders = cache(
  async (profileId: string): Promise<CustomerOrder[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customers.profile_id", profileId)
      .order("placed_at", { ascending: false })
      .limit(50)
      .overrideTypes<OrderRow[], { merge: false }>();
    if (error) throw error;
    return data.map(toOrder);
  },
);

/** One of the viewer's orders, or null (also for other people's orders). */
export async function getMyOrder(
  profileId: string,
  orderId: string,
): Promise<CustomerOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .eq("customers.profile_id", profileId)
    .maybeSingle()
    .overrideTypes<OrderRow, { merge: false }>();
  if (error) throw error;
  return data ? toOrder(data) : null;
}

/** The viewer's most recent non-cancelled order at a farm (for "Repeat"). */
export async function getLastOrderAtFarm(
  profileId: string,
  tenantId: string,
): Promise<CustomerOrder | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("customers.profile_id", profileId)
    .neq("status", "CANCELLED")
    .order("placed_at", { ascending: false })
    .limit(1)
    .maybeSingle()
    .overrideTypes<OrderRow, { merge: false }>();
  if (error) throw error;
  return data ? toOrder(data) : null;
}
