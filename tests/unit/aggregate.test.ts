import { describe, expect, it } from "vitest";
import {
  aggregateTotals,
  isFinalStatus,
  nextStatus,
  type AggregatableOrder,
} from "@/lib/farm/aggregate";

const line = (
  productId: string,
  name: string,
  quantity: number,
  price: number,
) => ({
  productId,
  name,
  unitCode: "kg",
  quantity,
  total: quantity * price,
});

const orders: AggregatableOrder[] = [
  {
    status: "PLACED",
    total: 1610,
    lines: [line("t", "Domate", 5, 250), line("c", "Kastravec", 2, 180)],
  },
  { status: "CONFIRMED", total: 625, lines: [line("t", "Domate", 2.5, 250)] },
  { status: "CANCELLED", total: 2500, lines: [line("t", "Domate", 10, 250)] },
  {
    status: "DELIVERED",
    total: 270,
    lines: [line("c", "Kastravec", 1.5, 180)],
  },
];

describe("aggregateTotals", () => {
  it("sums quantities per product and ignores cancelled orders", () => {
    const totals = aggregateTotals(orders);
    expect(totals.products).toEqual([
      {
        productId: "t",
        name: "Domate",
        unitCode: "kg",
        quantity: 7.5,
        orderCount: 2,
        amount: 1875,
      },
      {
        productId: "c",
        name: "Kastravec",
        unitCode: "kg",
        quantity: 3.5,
        orderCount: 2,
        amount: 630,
      },
    ]);
    expect(totals.orderCount).toBe(3);
    expect(totals.amount).toBe(2505);
  });

  it("can be limited to orders that still need preparing", () => {
    const totals = aggregateTotals(orders, ["PLACED", "CONFIRMED"]);
    expect(totals.products.map((p) => [p.name, p.quantity])).toEqual([
      ["Domate", 7.5],
      ["Kastravec", 2],
    ]);
  });

  it("never includes cancelled orders even if asked", () => {
    expect(aggregateTotals(orders, ["CANCELLED"]).orderCount).toBe(0);
  });

  it("avoids floating point noise", () => {
    const tiny = aggregateTotals([
      {
        status: "PLACED",
        total: 0,
        lines: [line("g", "Gjizë", 0.1, 0), line("g", "Gjizë", 0.2, 0)],
      },
    ]);
    expect(tiny.products[0].quantity).toBe(0.3);
    expect(tiny.products[0].orderCount).toBe(1);
  });
});

describe("status flow", () => {
  it("moves one step forward per tap", () => {
    expect(nextStatus("PLACED")).toBe("CONFIRMED");
    expect(nextStatus("READY")).toBe("DELIVERED");
    expect(nextStatus("DELIVERED")).toBeNull();
    expect(nextStatus("CANCELLED")).toBeNull();
  });

  it("knows the final statuses", () => {
    expect(isFinalStatus("DELIVERED")).toBe(true);
    expect(isFinalStatus("CANCELLED")).toBe(true);
    expect(isFinalStatus("PREPARING")).toBe(false);
  });
});
