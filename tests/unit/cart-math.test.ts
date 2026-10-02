import { describe, expect, it } from "vitest";
import {
  clampQuantity,
  decrement,
  increment,
  isSoldOut,
  lineTotal,
  maxQuantity,
  minQuantity,
  reconcileCart,
  summarizeCart,
} from "@/lib/cart/math";
import { offer, offerItem } from "./fixtures";

describe("increment / decrement", () => {
  const tomato = offerItem();

  it("first tap adds one step, then steps up", () => {
    expect(increment(tomato, 0)).toBe(0.5);
    expect(increment(tomato, 0.5)).toBe(1);
  });

  it("first tap adds the minimum when the farm sets one", () => {
    expect(increment(offerItem({ minimum: 2 }), 0)).toBe(2);
  });

  it("never exceeds the per-customer maximum or remaining stock", () => {
    expect(increment(offerItem({ maximum: 3 }), 3)).toBe(3);
    expect(increment(offerItem({ remaining: 1.2 }), 1)).toBe(1);
  });

  it("removes the line when going below the minimum", () => {
    expect(decrement(tomato, 0.5)).toBe(0);
    expect(decrement(offerItem({ minimum: 2 }), 2)).toBe(0);
    expect(decrement(tomato, 2)).toBe(1.5);
  });

  it("handles awkward steps without float noise", () => {
    const cheese = offerItem({ step: 0.25 });
    let q = 0;
    for (let i = 0; i < 3; i++) q = increment(cheese, q);
    expect(q).toBe(0.75);
    const grams = offerItem({ step: 0.1 });
    expect(increment(grams, 0.2)).toBe(0.3);
  });
});

describe("limits", () => {
  it("unlimited stock when inventory is not enforced", () => {
    expect(maxQuantity(offerItem({ remaining: null }))).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("floors remaining stock to the step", () => {
    expect(maxQuantity(offerItem({ remaining: 2.7 }))).toBe(2.5);
  });

  it("is sold out when less than the minimum remains", () => {
    expect(isSoldOut(offerItem({ remaining: 0.4 }))).toBe(true);
    expect(isSoldOut(offerItem({ remaining: 1, minimum: 2 }))).toBe(true);
    expect(isSoldOut(offerItem())).toBe(false);
    expect(minQuantity(offerItem({ minimum: 0.7 }))).toBe(1);
  });
});

describe("clampQuantity", () => {
  it("snaps down to the step and caps at the maximum", () => {
    const tomato = offerItem({ maximum: 5 });
    expect(clampQuantity(tomato, 2.3)).toBe(2);
    expect(clampQuantity(tomato, 9)).toBe(5);
  });

  it("returns 0 for invalid or unorderable quantities", () => {
    expect(clampQuantity(offerItem(), -1)).toBe(0);
    expect(clampQuantity(offerItem(), Number.NaN)).toBe(0);
    expect(clampQuantity(offerItem({ minimum: 3 }), 2)).toBe(0);
    expect(clampQuantity(offerItem({ remaining: 0 }), 1)).toBe(0);
  });
});

describe("totals", () => {
  it("rounds like numeric(12,2) in the database", () => {
    expect(lineTotal(0.75, 950)).toBe(712.5);
    expect(lineTotal(0.333, 100)).toBe(33.3);
  });

  it("summarises lines in offer order and ignores unknown items", () => {
    const tomato = offerItem();
    const cucumber = offerItem({
      id: "ai-cucumber",
      productId: "p-cucumber",
      name: "Kastravec",
      price: 180,
    });
    const o = offer([tomato, cucumber]);
    const summary = summarizeCart(
      { "ai-cucumber": 2, "ai-tomato": 1.5, "ai-gone": 4 },
      o,
    );
    expect(summary.lines.map((l) => l.item.name)).toEqual([
      "Domate",
      "Kastravec",
    ]);
    expect(summary.subtotal).toBe(375 + 360);
    expect(summary.count).toBe(2);
  });
});

describe("reconcileCart", () => {
  it("drops items no longer offered and clamps to current stock", () => {
    const o = offer([offerItem({ remaining: 2 })]);
    const { lines, changed } = reconcileCart(
      { "ai-tomato": 5, "ai-old": 1 },
      o,
    );
    expect(lines).toEqual({ "ai-tomato": 2 });
    expect(changed).toBe(true);
  });

  it("reports no change for a valid cart", () => {
    const o = offer([offerItem()]);
    expect(reconcileCart({ "ai-tomato": 1.5 }, o).changed).toBe(false);
  });
});
