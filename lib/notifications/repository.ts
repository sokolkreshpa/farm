import "server-only";
import type { OutboxRepository } from "@/lib/notifications/outbox";
import type {
  OrderEmailData,
  OutboxNotification,
} from "@/lib/notifications/types";
import { createAdminClient } from "@/lib/supabase/admin";

// The outbox is service-role only (no RLS grants), so this uses the secret key.

export function createOutboxRepository(): OutboxRepository {
  const admin = createAdminClient();

  return {
    async claim(limit) {
      const { data, error } = await admin.rpc("claim_notifications", {
        p_limit: limit,
      });
      if (error) throw error;
      return (data ?? []).map((row): OutboxNotification => ({
        id: row.id,
        event: row.event,
        recipient: row.recipient,
        locale: row.locale === "en" ? "en" : "sq",
        payload: (row.payload ?? {}) as OutboxNotification["payload"],
        attempts: row.attempts,
      }));
    },

    async loadOrder(orderId) {
      const [orderRes, historyRes] = await Promise.all([
        admin
          .from("orders")
          .select(
            `id, order_number, status, delivery_method, subtotal, delivery_fee, total,
             currency, customer_name, customer_phone, delivery_address, delivery_city,
             delivery_notes, notes,
             weekly_cycles ( week_start, week_end,
               tenants ( name, slug, phone, timezone, delivery_information, pickup_information ) ),
             order_items ( product_name_snapshot, unit_snapshot, quantity, unit_price, total_price )`,
          )
          .eq("id", orderId)
          .maybeSingle(),
        admin
          .from("order_status_history")
          .select("note")
          .eq("order_id", orderId)
          .eq("to_status", "CANCELLED")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (orderRes.error) throw orderRes.error;
      const o = orderRes.data;
      const cycle = o?.weekly_cycles;
      const tenant = cycle?.tenants;
      if (!o || !cycle || !tenant) return null;

      const data: OrderEmailData = {
        orderId: o.id,
        orderNumber: o.order_number,
        status: o.status,
        deliveryMethod: o.delivery_method,
        subtotal: Number(o.subtotal),
        deliveryFee: Number(o.delivery_fee),
        total: Number(o.total),
        currency: o.currency,
        customerName: o.customer_name,
        customerPhone: o.customer_phone,
        deliveryAddress: o.delivery_address,
        deliveryCity: o.delivery_city,
        deliveryNotes: o.delivery_notes,
        notes: o.notes,
        cancelReason: historyRes.data?.note ?? null,
        weekStart: cycle.week_start,
        weekEnd: cycle.week_end ?? cycle.week_start,
        farm: {
          name: tenant.name,
          slug: tenant.slug,
          phone: tenant.phone,
          timezone: tenant.timezone,
          deliveryInformation: tenant.delivery_information,
          pickupInformation: tenant.pickup_information,
        },
        lines: o.order_items
          .map((i) => ({
            name: i.product_name_snapshot,
            unitCode: i.unit_snapshot,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unit_price),
            total: Number(i.total_price),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      };
      return data;
    },

    async markSent(id) {
      await admin
        .from("notifications")
        .update({
          status: "SENT",
          sent_at: new Date().toISOString(),
          last_error: null,
        })
        .eq("id", id);
    },

    async markRetry(id, error, nextAttemptAt) {
      await admin
        .from("notifications")
        .update({
          last_error: error.slice(0, 1000),
          next_attempt_at: nextAttemptAt.toISOString(),
        })
        .eq("id", id);
    },

    async markFailed(id, error) {
      await admin
        .from("notifications")
        .update({ status: "FAILED", last_error: error.slice(0, 1000) })
        .eq("id", id);
    },
  };
}
