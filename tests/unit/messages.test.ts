import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import sq from "@/messages/sq.json";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" && value !== null
      ? keys(value, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("translations", () => {
  it("sq and en define exactly the same keys", () => {
    expect(keys(en).sort()).toEqual(keys(sq).sort());
  });

  it("has no empty strings", () => {
    for (const messages of [sq, en]) {
      const empty = keys(messages).filter((path) => {
        const value = path
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            messages,
          );
        return value === "";
      });
      expect(empty).toEqual([]);
    }
  });
});
