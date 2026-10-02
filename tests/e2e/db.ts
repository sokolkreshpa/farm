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
