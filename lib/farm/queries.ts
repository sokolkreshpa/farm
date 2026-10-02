import "server-only";
import { cache } from "react";
import type { AggregatableOrder } from "@/lib/farm/aggregate";
import { productImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

// Farmer-side reads. Every function takes the tenant id from requireFarmer()
// and filters by it (defence in depth on top of RLS). Errors are thrown.

type Enums = Database["public"]["Enums"];
export type CycleStatus = Enums["cycle_status"];
export type OrderStatus = Enums["order_status"];

export type CycleSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: CycleStatus;
  deadline: string;
  message: string | null;
};

export type FarmSettings = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  deliveryInformation: string | null;
  pickupInformation: string | null;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  currency: string;
  timezone: string;
  enforceInventory: boolean;
};

export const getFarmSettings = cache(
  async (tenantId: string): Promise<FarmSettings> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tenants")
      .select(
        "id, name, slug, description, phone, email, address, delivery_information, pickup_information, delivery_enabled, pickup_enabled, delivery_fee, currency, timezone, enforce_inventory",
      )
      .eq("id", tenantId)
      .single();
    if (error) throw error;
    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      phone: data.phone,
      email: data.email,
      address: data.address,
      deliveryInformation: data.delivery_information,
      pickupInformation: data.pickup_information,
      deliveryEnabled: data.delivery_enabled,
      pickupEnabled: data.pickup_enabled,
      deliveryFee: Number(data.delivery_fee),
      currency: data.currency,
      timezone: data.timezone,
      enforceInventory: data.enforce_inventory,
    };
  },
);

function toCycle(row: {
  id: string;
  week_start: string;
  week_end: string | null;
  status: CycleStatus;
  order_deadline: string;
  message: string | null;
}): CycleSummary {
  return {
    id: row.id,
    weekStart: row.week_start,
    weekEnd: row.week_end ?? row.week_start,
    status: row.status,
    deadline: row.order_deadline,
    message: row.message,
  };
}

export const getCycles = cache(
  async (tenantId: string): Promise<CycleSummary[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("weekly_cycles")
      .select("id, week_start, week_end, status, order_deadline, message")
      .eq("tenant_id", tenantId)
      .order("week_start", { ascending: false })
      .limit(60);
    if (error) throw error;
    return data.map(toCycle);
  },
);

/** The week the farmer is working on: the published one, else the latest. */
export async function getCurrentCycle(
  tenantId: string,
): Promise<CycleSummary | null> {
  const cycles = await getCycles(tenantId);
  return cycles.find((c) => c.status === "PUBLISHED") ?? cycles[0] ?? null;
}

export type EditorItem = {
  id: string;
  productId: string;
  name: string;
  unitCode: string;
  step: number;
  imageUrl: string | null;
  productActive: boolean;
  price: number;
  availableQuantity: number;
  orderedQuantity: number;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  listed: boolean;
};

export type CatalogueProduct = {
  id: string;
  name: string;
  unitCode: string;
  /** Last price/quantity offered, to prefill "add product". */
  lastPrice: number | null;
  lastQuantity: number | null;
};

export type CycleEditor = {
  cycle: CycleSummary;
  items: EditorItem[];
  /** Active products not yet in this week. */
  available: CatalogueProduct[];
};

export async function getCycleEditor(
  tenantId: string,
  cycleId: string,
): Promise<CycleEditor | null> {
  const supabase = await createClient();
  const [cycleRes, itemsRes, productsRes, historyRes] = await Promise.all([
    supabase
      .from("weekly_cycles")
      .select("id, week_start, week_end, status, order_deadline, message")
      .eq("tenant_id", tenantId)
      .eq("id", cycleId)
      .maybeSingle(),
    supabase
      .from("availability_items")
      .select(
        "id, price, available_quantity, ordered_quantity, minimum_quantity, maximum_quantity, listed, sort_order, products ( id, name, unit_code, quantity_step, image_path, active )",
      )
      .eq("tenant_id", tenantId)
      .eq("cycle_id", cycleId)
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, unit_code, sort_order")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order")
      .order("name"),
    supabase
      .from("availability_items")
      .select("product_id, price, available_quantity, created_at")
      .eq("tenant_id", tenantId)
      .neq("cycle_id", cycleId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  for (const res of [cycleRes, itemsRes, productsRes, historyRes]) {
    if (res.error) throw res.error;
  }
  if (!cycleRes.data) return null;

  const items: EditorItem[] = (itemsRes.data ?? [])
    .filter((row) => row.products)
    .map((row) => ({
      id: row.id,
      productId: row.products!.id,
      name: row.products!.name,
      unitCode: row.products!.unit_code,
      step: Number(row.products!.quantity_step),
      imageUrl: productImageUrl(row.products!.image_path),
      productActive: row.products!.active,
      price: Number(row.price),
      availableQuantity: Number(row.available_quantity),
      orderedQuantity: Number(row.ordered_quantity),
      minimumQuantity:
        row.minimum_quantity === null ? null : Number(row.minimum_quantity),
      maximumQuantity:
        row.maximum_quantity === null ? null : Number(row.maximum_quantity),
      listed: row.listed,
    }));

  const inWeek = new Set(items.map((i) => i.productId));
  const lastOffer = new Map<string, { price: number; quantity: number }>();
  for (const row of historyRes.data ?? []) {
    if (!lastOffer.has(row.product_id)) {
      lastOffer.set(row.product_id, {
        price: Number(row.price),
        quantity: Number(row.available_quantity),
      });
    }
  }

  return {
    cycle: toCycle(cycleRes.data),
    items,
    available: (productsRes.data ?? [])
      .filter((p) => !inWeek.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        unitCode: p.unit_code,
        lastPrice: lastOffer.get(p.id)?.price ?? null,
        lastQuantity: lastOffer.get(p.id)?.quantity ?? null,
      })),
  };
}

export type FarmOrder = Omit<AggregatableOrder, "lines"> & {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  deliveryMethod: Enums["delivery_method"];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  placedAt: string;
  cycleId: string;
  lines: (AggregatableOrder["lines"][number] & {
    id: string;
    unitPrice: number;
  })[];
};

const FARM_ORDER_SELECT = `
  id, order_number, status, delivery_method, subtotal, delivery_fee, total,
  currency, customer_id, customer_name, customer_phone, customer_email,
  delivery_address, delivery_city, delivery_notes, notes, placed_at, cycle_id,
  order_items ( id, product_id, product_name_snapshot, unit_snapshot, quantity, unit_price, total_price )
`;

type FarmOrderRow = {
  id: string;
  order_number: number;
  status: OrderStatus;
  delivery_method: Enums["delivery_method"];
  subtotal: number;
  delivery_fee: number;
  total: number;
  currency: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  delivery_address: string | null;
  delivery_city: string | null;
  delivery_notes: string | null;
  notes: string | null;
  placed_at: string;
  cycle_id: string;
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

function toFarmOrder(row: FarmOrderRow): FarmOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    deliveryMethod: row.delivery_method,
    subtotal: Number(row.subtotal),
    deliveryFee: Number(row.delivery_fee),
    total: Number(row.total),
    currency: row.currency,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    customerEmail: row.customer_email,
    deliveryAddress: row.delivery_address,
    deliveryCity: row.delivery_city,
    deliveryNotes: row.delivery_notes,
    notes: row.notes,
    placedAt: row.placed_at,
    cycleId: row.cycle_id,
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

export const getCycleOrders = cache(
  async (tenantId: string, cycleId: string): Promise<FarmOrder[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select(FARM_ORDER_SELECT)
      .eq("tenant_id", tenantId)
      .eq("cycle_id", cycleId)
      .order("order_number", { ascending: true })
      .overrideTypes<FarmOrderRow[], { merge: false }>();
    if (error) throw error;
    return data.map(toFarmOrder);
  },
);

export type StatusChange = {
  from: OrderStatus | null;
  to: OrderStatus;
  note: string | null;
  at: string;
};

export async function getFarmOrder(
  tenantId: string,
  orderId: string,
): Promise<(FarmOrder & { history: StatusChange[] }) | null> {
  const supabase = await createClient();
  const [orderRes, historyRes] = await Promise.all([
    supabase
      .from("orders")
      .select(FARM_ORDER_SELECT)
      .eq("tenant_id", tenantId)
      .eq("id", orderId)
      .maybeSingle()
      .overrideTypes<FarmOrderRow, { merge: false }>(),
    supabase
      .from("order_status_history")
      .select("from_status, to_status, note, created_at")
      .eq("tenant_id", tenantId)
      .eq("order_id", orderId)
      .order("created_at"),
  ]);
  if (orderRes.error) throw orderRes.error;
  if (historyRes.error) throw historyRes.error;
  if (!orderRes.data) return null;
  return {
    ...toFarmOrder(orderRes.data),
    history: historyRes.data.map((h) => ({
      from: h.from_status,
      to: h.to_status,
      note: h.note,
      at: h.created_at,
    })),
  };
}

export type FarmProduct = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unitCode: string;
  quantityStep: number;
  imagePath: string | null;
  imageUrl: string | null;
  active: boolean;
};

const PRODUCT_SELECT =
  "id, name, description, category, unit_code, quantity_step, image_path, active";

function toProduct(row: {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_code: string;
  quantity_step: number;
  image_path: string | null;
  active: boolean;
}): FarmProduct {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    unitCode: row.unit_code,
    quantityStep: Number(row.quantity_step),
    imagePath: row.image_path,
    imageUrl: productImageUrl(row.image_path),
    active: row.active,
  };
}

export async function getProducts(tenantId: string): Promise<FarmProduct[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", tenantId)
    .order("active", { ascending: false })
    .order("sort_order")
    .order("name");
  if (error) throw error;
  return data.map(toProduct);
}

export async function getProduct(
  tenantId: string,
  productId: string,
): Promise<FarmProduct | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("tenant_id", tenantId)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw error;
  return data ? toProduct(data) : null;
}

export type Unit = { code: string; defaultStep: number };

export const getUnits = cache(async (): Promise<Unit[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("code, default_step")
    .order("sort_order");
  if (error) throw error;
  return data.map((u) => ({
    code: u.code,
    defaultStep: Number(u.default_step),
  }));
});

export type FarmCustomer = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string;
  active: boolean;
  farmerNotes: string | null;
  joinedAt: string;
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
};

export async function getCustomers(tenantId: string): Promise<FarmCustomer[]> {
  const supabase = await createClient();
  const [customersRes, notesRes, ordersRes] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, active, created_at, profiles ( first_name, last_name, phone, email )",
      )
      .eq("tenant_id", tenantId),
    // Private to the farm (D-71): customers cannot read this table.
    supabase
      .from("customer_notes")
      .select("customer_id, notes")
      .eq("tenant_id", tenantId),
    supabase
      .from("orders")
      .select("customer_id, total, placed_at, status")
      .eq("tenant_id", tenantId)
      .neq("status", "CANCELLED"),
  ]);
  if (customersRes.error) throw customersRes.error;
  if (notesRes.error) throw notesRes.error;
  if (ordersRes.error) throw ordersRes.error;
  const notes = new Map(notesRes.data.map((n) => [n.customer_id, n.notes]));

  const stats = new Map<
    string,
    { count: number; total: number; last: string }
  >();
  for (const order of ordersRes.data) {
    const s = stats.get(order.customer_id) ?? { count: 0, total: 0, last: "" };
    s.count += 1;
    s.total = Math.round((s.total + Number(order.total)) * 100) / 100;
    if (order.placed_at > s.last) s.last = order.placed_at;
    stats.set(order.customer_id, s);
  }

  return customersRes.data
    .filter((c) => c.profiles)
    .map((c) => ({
      id: c.id,
      firstName: c.profiles!.first_name,
      lastName: c.profiles!.last_name,
      phone: c.profiles!.phone,
      email: c.profiles!.email,
      active: c.active,
      farmerNotes: notes.get(c.id) ?? null,
      joinedAt: c.created_at,
      orderCount: stats.get(c.id)?.count ?? 0,
      totalSpent: stats.get(c.id)?.total ?? 0,
      lastOrderAt: stats.get(c.id)?.last || null,
    }))
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(
        `${b.firstName} ${b.lastName}`,
      ),
    );
}

export async function getCustomerOrders(
  tenantId: string,
  customerId: string,
): Promise<FarmOrder[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(FARM_ORDER_SELECT)
    .eq("tenant_id", tenantId)
    .eq("customer_id", customerId)
    .order("placed_at", { ascending: false })
    .limit(50)
    .overrideTypes<FarmOrderRow[], { merge: false }>();
  if (error) throw error;
  return data.map(toFarmOrder);
}
