"use client";

// Lets other components (e.g. "Repeat order") open the cart drawer.
const OPEN_CART_EVENT = "farm-cart-open";

export function openCart() {
  window.dispatchEvent(new Event(OPEN_CART_EVENT));
}

export function onOpenCart(callback: () => void) {
  window.addEventListener(OPEN_CART_EVENT, callback);
  return () => window.removeEventListener(OPEN_CART_EVENT, callback);
}
