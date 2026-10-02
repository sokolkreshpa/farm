"use client";

import { ProductCard } from "@/components/shop/product-card";
import type { Offer } from "@/lib/catalog/types";
import { useOfferCart } from "@/lib/cart/use-cart";

type ProductGridProps = { slug: string; offer: Offer };

export function ProductGrid({ slug, offer }: ProductGridProps) {
  const { lines, setQuantity } = useOfferCart(slug, offer);

  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
      {offer.items.map((item) => (
        <li key={item.id}>
          <ProductCard
            item={item}
            currency={offer.currency}
            quantity={lines[item.id] ?? 0}
            ordering={offer.isOpen}
            onChange={(quantity) => setQuantity(item.id, quantity)}
          />
        </li>
      ))}
    </ul>
  );
}
