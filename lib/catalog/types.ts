/** A product offered in the open week, as shown to customers. */
export type OfferItem = {
  /** availability_items.id — what the cart and place_order() use. */
  id: string;
  productId: string;
  name: string;
  description: string | null;
  category: string | null;
  unitCode: string;
  /** Increment for the [-]/[+] buttons. */
  step: number;
  imageUrl: string | null;
  price: number;
  /** Remaining stock, or null when the farm does not enforce inventory. */
  remaining: number | null;
  minimum: number | null;
  maximum: number | null;
};

/** The farm's current ordering week. */
export type Offer = {
  cycleId: string;
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;
  deadline: string; // ISO timestamp
  message: string | null;
  /** Published and before the deadline. */
  isOpen: boolean;
  currency: string;
  items: OfferItem[];
};
