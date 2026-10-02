import { describe, expect, it } from "vitest";
import {
  homePathForRole,
  safeNextPath,
  safeRedirectTarget,
} from "@/lib/auth/redirect";

describe("safeNextPath", () => {
  it.each(["/f/ferma-kodra/checkout", "/en/account/orders", "/farm?x=1"])(
    "accepts same-site path %s",
    (path) => expect(safeNextPath(path)).toBe(path),
  );

  it.each([
    null,
    "",
    "https://evil.com",
    "//evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "farm",
    "/\nlocation",
  ])("rejects %j", (value) => expect(safeNextPath(value)).toBeNull());
});

describe("safeRedirectTarget", () => {
  const site = "https://farm.example.com";

  it("converts an absolute URL on our site to a path", () => {
    expect(
      safeRedirectTarget("https://farm.example.com/en/f/a/checkout?x=1", site),
    ).toBe("/en/f/a/checkout?x=1");
  });

  it("rejects other origins", () => {
    expect(safeRedirectTarget("https://evil.com/f/a", site)).toBeNull();
    expect(safeRedirectTarget("http://farm.example.com/f/a", site)).toBeNull();
  });

  it("accepts relative paths and rejects garbage", () => {
    expect(safeRedirectTarget("/account", site)).toBe("/account");
    expect(safeRedirectTarget("not a url", site)).toBeNull();
  });
});

describe("homePathForRole", () => {
  it("routes each role to its home", () => {
    expect(homePathForRole("FARMER")).toBe("/farm");
    expect(homePathForRole("PLATFORM_ADMIN")).toBe("/admin");
    expect(homePathForRole("CUSTOMER")).toBe("/");
  });
});
