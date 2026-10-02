import "server-only";
import { cache } from "react";
import type { Offer, OfferItem } from "@/lib/catalog/types";
import { productImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import type { PublicTenant } from "@/lib/tenants/queries";

/**
 * The farm's published week with its listed items, or null if nothing is
 * published. `isOpen` is false once the deadline has passed.
 */
export const getOpenOffer = cache(
  async (tenant: PublicTenant): Promise<Offer | null> => {
    const supabase = await createClient();
    const { data: cycle, error } = await supabase
      .from("weekly_cycles")
      .select(
        `id, week_start, week_end, order_deadline, message,
         availability_items (
           id, price, available_quantity, ordered_quantity, minimum_quantity,
           maximum_quantity, listed, sort_order,
           products ( id, name, description, category, unit_code, quantity_step, image_path, active )
         )`,
      )
      .eq("tenant_id", tenant.id)
      .eq("status", "PUBLISHED")
      .maybeSingle();
    if (error) throw error;
    if (!cycle) return null;

    const items: OfferItem[] = [];
    const sortOrder = new Map<string, number>();
    for (const row of cycle.availability_items) {
      const product = row.products;
      // Farmers can read unlisted rows through RLS; customers never see them.
      if (!row.listed || !product?.active) continue;
      items.push({
        id: row.id,
        productId: product.id,
        name: product.name,
        description: product.description,
        category: product.category,
        unitCode: product.unit_code,
        step: Number(product.quantity_step),
        imageUrl: productImageUrl(product.image_path),
        price: Number(row.price),
        remaining: tenant.enforceInventory
          ? Math.max(
              Number(row.available_quantity) - Number(row.ordered_quantity),
              0,
            )
          : null,
        minimum:
          row.minimum_quantity === null ? null : Number(row.minimum_quantity),
        maximum:
          row.maximum_quantity === null ? null : Number(row.maximum_quantity),
      });
      sortOrder.set(row.id, row.sort_order);
    }
    items.sort(
      (a, b) =>
        (sortOrder.get(a.id) ?? 0) - (sortOrder.get(b.id) ?? 0) ||
        a.name.localeCompare(b.name),
    );

    return {
      cycleId: cycle.id,
      weekStart: cycle.week_start,
      weekEnd: cycle.week_end ?? cycle.week_start,
      deadline: cycle.order_deadline,
      message: cycle.message,
      isOpen: new Date(cycle.order_deadline).getTime() > Date.now(),
      currency: tenant.currency,
      items,
    };
  },
);
