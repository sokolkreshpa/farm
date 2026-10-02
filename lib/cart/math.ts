import type { Offer, OfferItem } from "@/lib/catalog/types";

// Pure cart arithmetic. Mirrors the rules enforced by place_order() so the UI
// never proposes a quantity the database would reject.

/** Quantities are numeric(10,3) in the DB: normalise float noise. */
export function normalizeQuantity(value: number): number {
  return Number(value.toFixed(3));
}

/** Money is numeric(12,2): same rounding as round(quantity * price, 2). */
export function lineTotal(quantity: number, price: number): number {
  return Math.round(normalizeQuantity(quantity) * price * 100) / 100;
}

function isMultipleOfStep(quantity: number, step: number): boolean {
  const ratio = normalizeQuantity(quantity / step);
  return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

function floorToStep(quantity: number, step: number): number {
  return normalizeQuantity(
    Math.floor(normalizeQuantity(quantity / step)) * step,
  );
}

function ceilToStep(quantity: number, step: number): number {
  return normalizeQuantity(
    Math.ceil(normalizeQuantity(quantity / step)) * step,
  );
}

/** Smallest quantity a customer can order (at least one step). */
export function minQuantity(item: OfferItem): number {
  return ceilToStep(Math.max(item.minimum ?? item.step, item.step), item.step);
}

/** Largest quantity a customer can order (per-customer max and stock). */
export function maxQuantity(item: OfferItem): number {
  const limit = Math.min(
    item.maximum ?? Number.POSITIVE_INFINITY,
    item.remaining ?? Number.POSITIVE_INFINITY,
  );
  return Number.isFinite(limit) ? floorToStep(limit, item.step) : limit;
}

export function isSoldOut(item: OfferItem): boolean {
  return maxQuantity(item) < minQuantity(item);
}

/** [+]: first tap adds the minimum, then one step at a time up to the max. */
export function increment(item: OfferItem, quantity: number): number {
  if (isSoldOut(item)) return 0;
  const next = quantity <= 0 ? minQuantity(item) : quantity + item.step;
  return normalizeQuantity(Math.min(next, maxQuantity(item)));
}

/** [-]: going below the minimum removes the line. */
export function decrement(item: OfferItem, quantity: number): number {
  const next = normalizeQuantity(quantity - item.step);
  return next < minQuantity(item) ? 0 : next;
}

/** A valid quantity for this item, or 0 if it cannot be ordered. */
export function clampQuantity(item: OfferItem, quantity: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || isSoldOut(item)) return 0;
  const onStep = isMultipleOfStep(quantity, item.step)
    ? normalizeQuantity(quantity)
    : floorToStep(quantity, item.step);
  const bounded = Math.min(onStep, maxQuantity(item));
  return bounded < minQuantity(item) ? 0 : normalizeQuantity(bounded);
}

/** Cart contents: availability item id -> quantity. */
export type CartLines = Record<string, number>;

export type CartSummaryLine = {
  item: OfferItem;
  quantity: number;
  total: number;
};

export type CartSummary = {
  lines: CartSummaryLine[];
  subtotal: number;
  /** Number of distinct products. */
  count: number;
};

export function summarizeCart(lines: CartLines, offer: Offer): CartSummary {
  const byId = new Map(offer.items.map((item) => [item.id, item]));
  const summary: CartSummaryLine[] = [];
  for (const [id, quantity] of Object.entries(lines)) {
    const item = byId.get(id);
    if (!item || quantity <= 0) continue;
    summary.push({ item, quantity, total: lineTotal(quantity, item.price) });
  }
  summary.sort(
    (a, b) => offer.items.indexOf(a.item) - offer.items.indexOf(b.item),
  );
  const subtotal =
    Math.round(summary.reduce((sum, l) => sum + l.total, 0) * 100) / 100;
  return { lines: summary, subtotal, count: summary.length };
}

/**
 * Fits a stored cart to the current offer: drops lines that are no longer
 * offered and clamps quantities to what can still be ordered.
 */
export function reconcileCart(
  lines: CartLines,
  offer: Offer,
): { lines: CartLines; changed: boolean } {
  const byId = new Map(offer.items.map((item) => [item.id, item]));
  const result: CartLines = {};
  let changed = false;
  for (const [id, quantity] of Object.entries(lines)) {
    const item = byId.get(id);
    const clamped = item ? clampQuantity(item, quantity) : 0;
    if (clamped > 0) result[id] = clamped;
    if (clamped !== quantity) changed = true;
  }
  return { lines: result, changed };
}
