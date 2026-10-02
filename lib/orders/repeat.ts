import { clampQuantity, isSoldOut, type CartLines } from "@/lib/cart/math";
import type { Offer, OfferItem } from "@/lib/catalog/types";

/** A line of a previous order (from order_items snapshots). */
export type PastOrderLine = {
  productId: string;
  name: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
};

export type RepeatLine = {
  productId: string;
  name: string;
  unitCode: string;
  previousQuantity: number;
  previousPrice: number;
  /**
   * available   — same quantity can be ordered again
   * reduced     — offered, but less is available (stock / per-customer max)
   * unavailable — not offered this week, unlisted, or sold out
   */
  status: "available" | "reduced" | "unavailable";
  quantity: number;
  item: OfferItem | null;
  priceChanged: boolean;
};

/**
 * Builds the "Repeat last order" proposal (spec §12): matches previous lines
 * to this week's offer by product and fits each quantity to what can be ordered.
 */
export function buildRepeatCart(
  past: PastOrderLine[],
  offer: Offer | null,
): RepeatLine[] {
  const byProduct = new Map(
    (offer?.isOpen ? offer.items : []).map((item) => [item.productId, item]),
  );

  return past.map((line) => {
    const item = byProduct.get(line.productId) ?? null;
    const base = {
      productId: line.productId,
      name: item?.name ?? line.name,
      unitCode: item?.unitCode ?? line.unitCode,
      previousQuantity: line.quantity,
      previousPrice: line.unitPrice,
    };

    if (!item || isSoldOut(item)) {
      return {
        ...base,
        status: "unavailable",
        quantity: 0,
        item: null,
        priceChanged: false,
      };
    }

    // If the farm raised the minimum, offer the minimum rather than nothing.
    const quantity =
      clampQuantity(item, line.quantity) ||
      clampQuantity(item, Math.max(line.quantity, item.minimum ?? 0));
    return {
      ...base,
      status:
        quantity === 0
          ? "unavailable"
          : quantity < line.quantity
            ? "reduced"
            : "available",
      quantity,
      item: quantity === 0 ? null : item,
      priceChanged: item.price !== line.unitPrice,
    };
  });
}

/** Cart lines for everything that can be repeated. */
export function repeatToCart(lines: RepeatLine[]): CartLines {
  const cart: CartLines = {};
  for (const line of lines) {
    if (line.item && line.quantity > 0) cart[line.item.id] = line.quantity;
  }
  return cart;
}
