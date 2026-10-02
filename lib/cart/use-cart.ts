"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { reconcileCart, type CartLines } from "@/lib/cart/math";
import type { Offer } from "@/lib/catalog/types";

// The cart lives in localStorage, per farm, tagged with the week it was built
// for (D-12). It holds only {availabilityItemId: quantity}; prices always come
// from the server. A cart from another week is ignored.

type StoredCart = { cycleId: string; lines: CartLines };

const EVENT = "farm-cart-change";
const storageKey = (slug: string) => `farm-cart:v1:${slug}`;

function readRaw(slug: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(slug));
  } catch {
    return null; // storage blocked (private mode, embedded views)
  }
}

function write(slug: string, cart: StoredCart | null) {
  try {
    if (cart && Object.keys(cart.lines).length > 0) {
      window.localStorage.setItem(storageKey(slug), JSON.stringify(cart));
    } else {
      window.localStorage.removeItem(storageKey(slug));
    }
  } catch {
    // Ignore: the cart then only lives for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

function parse(raw: string | null, cycleId: string): CartLines {
  if (!raw) return {};
  try {
    const cart = JSON.parse(raw) as Partial<StoredCart>;
    if (
      cart.cycleId !== cycleId ||
      typeof cart.lines !== "object" ||
      !cart.lines
    ) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(cart.lines).filter(
        ([, q]) => typeof q === "number" && Number.isFinite(q) && q > 0,
      ),
    );
  } catch {
    return {};
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback); // other tabs
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useCart(slug: string, cycleId: string) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(slug),
    () => null,
  );
  const lines = useMemo(() => parse(raw, cycleId), [raw, cycleId]);

  const setQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const current = parse(readRaw(slug), cycleId);
      const next = { ...current };
      if (quantity > 0) next[itemId] = quantity;
      else delete next[itemId];
      write(slug, { cycleId, lines: next });
    },
    [slug, cycleId],
  );

  const replace = useCallback(
    (next: CartLines) => write(slug, { cycleId, lines: next }),
    [slug, cycleId],
  );

  const clear = useCallback(() => write(slug, null), [slug]);

  return { lines, setQuantity, replace, clear };
}

/**
 * The cart fitted to the current offer: lines no longer offered are dropped and
 * quantities clamped to what can still be ordered. `adjusted` stays true until
 * the customer changes the cart, so they can be told about it.
 */
export function useOfferCart(slug: string, offer: Offer) {
  const { lines: stored, replace, clear } = useCart(slug, offer.cycleId);
  const { lines, changed } = useMemo(
    () => reconcileCart(stored, offer),
    [stored, offer],
  );

  const setQuantity = useCallback(
    (itemId: string, quantity: number) => {
      const next = { ...lines };
      if (quantity > 0) next[itemId] = quantity;
      else delete next[itemId];
      replace(next);
    },
    [lines, replace],
  );

  return { lines, adjusted: changed, setQuantity, replace, clear };
}

const noopSubscribe = () => () => {};

/** False during SSR and hydration, true afterwards (cart is client-only). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
