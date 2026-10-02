import { readFileSync } from "node:fs";

// Test-only access to the local Supabase REST API with the secret key, to look
// up fixture ids. Never used by the app.

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
    }
  } catch {
    // CI provides real environment variables instead.
  }
  return { ...env, ...(process.env as Record<string, string>) };
}

const env = loadEnv();

export async function adminSelect<T>(path: string): Promise<T> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase URL / secret key not configured");
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export async function orderIdByNumber(
  tenantSlug: string,
  orderNumber: number,
): Promise<string> {
  const [tenant] = await adminSelect<{ id: string }[]>(
    `tenants?slug=eq.${tenantSlug}&select=id`,
  );
  const [order] = await adminSelect<{ id: string }[]>(
    `orders?tenant_id=eq.${tenant.id}&order_number=eq.${orderNumber}&select=id`,
  );
  return order.id;
}

export async function adminPatch(
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SECRET_KEY;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
}

/** Current-week availability item of farm A for a product name. */
export async function currentItem(productName: string): Promise<{
  id: string;
  available_quantity: number;
  ordered_quantity: number;
}> {
  const [cycle] = await adminSelect<{ id: string }[]>(
    "weekly_cycles?status=eq.PUBLISHED&tenant_id=eq.10000000-0000-4000-a000-00000000000a&select=id",
  );
  const [product] = await adminSelect<{ id: string }[]>(
    `products?tenant_id=eq.10000000-0000-4000-a000-00000000000a&name=eq.${encodeURIComponent(productName)}&select=id`,
  );
  const [item] = await adminSelect<
    { id: string; available_quantity: number; ordered_quantity: number }[]
  >(
    `availability_items?cycle_id=eq.${cycle.id}&product_id=eq.${product.id}&select=id,available_quantity,ordered_quantity`,
  );
  return item;
}
