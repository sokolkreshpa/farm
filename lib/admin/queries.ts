import "server-only";
import { createClient } from "@/lib/supabase/server";

// Platform-admin reads go through the admin's own session: RLS grants
// platform admins read access across tenants (docs/database.md §7).

export type AdminFarm = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  createdAt: string;
  farmers: { name: string; email: string }[];
  customerCount: number;
  orderCount: number;
};

export async function getAdminFarms(): Promise<AdminFarm[]> {
  const supabase = await createClient();
  const [tenantsRes, membersRes, customersRes, ordersRes] = await Promise.all([
    supabase
      .from("tenants")
      .select("id, name, slug, active, created_at")
      .order("created_at"),
    supabase
      .from("tenant_members")
      .select("tenant_id, profiles ( first_name, last_name, email )"),
    supabase.from("customers").select("tenant_id"),
    supabase.from("orders").select("tenant_id").neq("status", "CANCELLED"),
  ]);
  for (const res of [tenantsRes, membersRes, customersRes, ordersRes]) {
    if (res.error) throw res.error;
  }

  const count = (rows: { tenant_id: string }[] | null) => {
    const map = new Map<string, number>();
    for (const row of rows ?? [])
      map.set(row.tenant_id, (map.get(row.tenant_id) ?? 0) + 1);
    return map;
  };
  const customers = count(customersRes.data);
  const orders = count(ordersRes.data);

  return (tenantsRes.data ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    active: t.active,
    createdAt: t.created_at,
    farmers: (membersRes.data ?? [])
      .filter((m) => m.tenant_id === t.id && m.profiles)
      .map((m) => ({
        name: `${m.profiles!.first_name} ${m.profiles!.last_name}`.trim(),
        email: m.profiles!.email,
      })),
    customerCount: customers.get(t.id) ?? 0,
    orderCount: orders.get(t.id) ?? 0,
  }));
}

export type DeletionRequest = {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
};

export async function getDeletionRequests(): Promise<DeletionRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, deletion_requested_at")
    .not("deletion_requested_at", "is", null)
    .order("deletion_requested_at");
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    name: `${p.first_name} ${p.last_name}`.trim(),
    email: p.email,
    requestedAt: p.deletion_requested_at!,
  }));
}
