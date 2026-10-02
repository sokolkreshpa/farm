import { describe, expect, it } from "vitest";
import { formatMoney, formatQuantity } from "@/lib/format";

const NBSP = " ";

describe("formatMoney", () => {
  it("formats Albanian lek without decimals", () => {
    expect(formatMoney(146500, "ALL", "sq")).toBe(`146${NBSP}500${NBSP}Lekë`);
    expect(formatMoney(250, "ALL", "en")).toBe(`250${NBSP}ALL`);
    expect(formatMoney(1250, "ALL", "en")).toBe(`1,250${NBSP}ALL`);
  });

  it("rounds lek to whole numbers", () => {
    expect(formatMoney(712.5, "ALL", "sq")).toBe(`713${NBSP}Lekë`);
  });

  it("uses two decimals for other currencies", () => {
    expect(formatMoney(25, "EUR", "sq")).toBe(`25,00${NBSP}€`);
    expect(formatMoney(1234.5, "EUR", "en")).toBe(`1,234.50${NBSP}€`);
    expect(formatMoney(3, "USD", "en")).toBe(`3.00${NBSP}USD`);
  });

  it("is identical for regional locale variants", () => {
    expect(formatMoney(250, "ALL", "sq-AL")).toBe(
      formatMoney(250, "ALL", "sq"),
    );
  });
});

describe("formatQuantity", () => {
  it("uses the locale decimal separator and trims zeros", () => {
    expect(formatQuantity(2.5, "sq")).toBe("2,5");
    expect(formatQuantity(2.5, "en")).toBe("2.5");
    expect(formatQuantity(3, "sq")).toBe("3");
    expect(formatQuantity(0.75, "en")).toBe("0.75");
    expect(formatQuantity(0.125, "sq")).toBe("0,125");
  });
});
