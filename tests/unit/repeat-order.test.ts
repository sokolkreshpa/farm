import { describe, expect, it } from "vitest";
import {
  buildRepeatCart,
  repeatToCart,
  type PastOrderLine,
} from "@/lib/orders/repeat";
import { offer, offerItem } from "./fixtures";

const lastOrder: PastOrderLine[] = [
  {
    productId: "p-tomato",
    name: "Domate",
    unitCode: "kg",
    quantity: 5,
    unitPrice: 220,
  },
  {
    productId: "p-cucumber",
    name: "Kastravec",
    unitCode: "kg",
    quantity: 2,
    unitPrice: 180,
  },
  {
    productId: "p-lettuce",
    name: "Sallatë",
    unitCode: "piece",
    quantity: 3,
    unitPrice: 100,
  },
  {
    productId: "p-apple",
    name: "Mollë",
    unitCode: "kg",
    quantity: 2,
    unitPrice: 150,
  },
];

const thisWeek = offer([
  offerItem({ id: "ai-tomato", productId: "p-tomato", price: 250 }),
  offerItem({
    id: "ai-cucumber",
    productId: "p-cucumber",
    name: "Kastravec",
    price: 180,
    remaining: 1.5,
  }),
  offerItem({
    id: "ai-lettuce",
    productId: "p-lettuce",
    name: "Sallatë",
    unitCode: "piece",
    step: 1,
    price: 100,
    remaining: 0,
  }),
]);

describe("buildRepeatCart", () => {
  const lines = buildRepeatCart(lastOrder, thisWeek);
  const byName = Object.fromEntries(lines.map((l) => [l.name, l]));

  it("repeats available products with the same quantity", () => {
    expect(byName.Domate).toMatchObject({ status: "available", quantity: 5 });
  });

  it("flags price changes so the customer is not surprised", () => {
    expect(byName.Domate.priceChanged).toBe(true);
    expect(byName.Kastravec.priceChanged).toBe(false);
  });

  it("reduces quantities to the remaining stock", () => {
    expect(byName.Kastravec).toMatchObject({
      status: "reduced",
      quantity: 1.5,
    });
  });

  it("marks sold-out and no-longer-offered products as unavailable", () => {
    expect(byName["Sallatë"]).toMatchObject({
      status: "unavailable",
      quantity: 0,
    });
    expect(byName["Mollë"]).toMatchObject({
      status: "unavailable",
      item: null,
    });
  });

  it("keeps the original order of lines", () => {
    expect(lines.map((l) => l.productId)).toEqual(
      lastOrder.map((l) => l.productId),
    );
  });

  it("offers the new minimum when the farm raised it", () => {
    const [line] = buildRepeatCart(
      [{ ...lastOrder[0], quantity: 1 }],
      offer([offerItem({ minimum: 2 })]),
    );
    expect(line).toMatchObject({ status: "available", quantity: 2 });
  });

  it("everything is unavailable when ordering is closed", () => {
    const closed = buildRepeatCart(lastOrder, { ...thisWeek, isOpen: false });
    expect(closed.every((l) => l.status === "unavailable")).toBe(true);
    expect(buildRepeatCart(lastOrder, null)[0].status).toBe("unavailable");
  });
});

describe("repeatToCart", () => {
  it("contains only the lines that can be ordered", () => {
    expect(repeatToCart(buildRepeatCart(lastOrder, thisWeek))).toEqual({
      "ai-tomato": 5,
      "ai-cucumber": 1.5,
    });
  });
});
