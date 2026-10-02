import type { Offer, OfferItem } from "@/lib/catalog/types";

export function offerItem(overrides: Partial<OfferItem> = {}): OfferItem {
  return {
    id: "ai-tomato",
    productId: "p-tomato",
    name: "Domate",
    description: null,
    category: "Perime",
    unitCode: "kg",
    step: 0.5,
    imageUrl: null,
    price: 250,
    remaining: 100,
    minimum: null,
    maximum: null,
    ...overrides,
  };
}

export function offer(
  items: OfferItem[],
  overrides: Partial<Offer> = {},
): Offer {
  return {
    cycleId: "cycle-1",
    weekStart: "2026-10-05",
    weekEnd: "2026-10-11",
    deadline: "2026-10-08T18:00:00Z",
    message: null,
    isOpen: true,
    currency: "ALL",
    items,
    ...overrides,
  };
}
