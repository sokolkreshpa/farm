"use server";

import { getViewer } from "@/lib/dal/session";
import { toErrorKey } from "@/lib/i18n/errors";
import {
  parsePlaceOrderError,
  type PlaceOrderError,
} from "@/lib/orders/errors";
import { createClient } from "@/lib/supabase/server";
import { fieldErrors, type FieldErrors } from "@/lib/validation/auth";
import { placeOrderSchema, type PlaceOrderInput } from "@/lib/validation/order";

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderNumber: number }
  | { ok: false; error: PlaceOrderError; fields?: FieldErrors };

/**
 * Checkout. Validates input, saves a new delivery address if given, and calls
 * place_order(), which re-validates everything and prices the order from the
 * database (client prices are never trusted).
 */
export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const parsed = placeOrderSchema.safeParse(input);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    return {
      ok: false,
      error: { code: toErrorKey(parsed.error.issues[0]?.message) },
      fields,
    };
  }
  const order = parsed.data;

  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: { code: "NOT_AUTHENTICATED" } };

  const supabase = await createClient();

  let addressId =
    order.deliveryMethod === "DELIVERY" ? order.addressId : undefined;
  if (order.deliveryMethod === "DELIVERY" && !addressId && order.newAddress) {
    const { newAddress } = order;
    const { data: existing } = await supabase
      .from("addresses")
      .select("id, address_line, city")
      .eq("profile_id", viewer.id);
    const same = existing?.find(
      (a) =>
        a.address_line.toLowerCase() === newAddress.addressLine.toLowerCase() &&
        a.city.toLowerCase() === newAddress.city.toLowerCase(),
    );
    if (same) {
      addressId = same.id;
    } else {
      const { data: created, error } = await supabase
        .from("addresses")
        .insert({
          profile_id: viewer.id,
          label: newAddress.label ?? null,
          address_line: newAddress.addressLine,
          city: newAddress.city,
          notes: newAddress.notes ?? null,
          is_default: !existing?.length,
        })
        .select("id")
        .single();
      if (error || !created) return { ok: false, error: { code: "generic" } };
      addressId = created.id;
    }
  }

  const { data, error } = await supabase
    .rpc("place_order", {
      p_tenant_slug: order.tenantSlug,
      p_cycle_id: order.cycleId,
      p_items: order.items.map((i) => ({
        availability_item_id: i.availabilityItemId,
        quantity: i.quantity,
      })),
      p_delivery_method: order.deliveryMethod,
      p_phone: order.phone,
      p_idempotency_key: order.idempotencyKey,
      p_address_id: addressId,
      p_delivery_notes: order.deliveryNotes,
      p_notes: order.notes,
    })
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error ? parsePlaceOrderError(error) : { code: "generic" },
    };
  }

  // Remember the phone for next time.
  if (!viewer.phone) {
    await supabase
      .from("profiles")
      .update({ phone: order.phone })
      .eq("id", viewer.id);
  }

  return { ok: true, orderId: data.order_id, orderNumber: data.order_number };
}
