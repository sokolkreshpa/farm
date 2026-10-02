import { describe, expect, it } from "vitest";
import {
  fieldErrors,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";

const validRegistration = {
  firstName: "Ana",
  lastName: "Hoxha",
  phone: "069 123 4567",
  email: "  Ana@Example.com ",
  password: "Domate2026",
  privacyAccepted: "on",
  farm: "ferma-kodra",
};

describe("registerSchema", () => {
  it("accepts a valid registration and normalises the email", () => {
    const result = registerSchema.parse(validRegistration);
    expect(result.email).toBe("ana@example.com");
    expect(result.farm).toBe("ferma-kodra");
  });

  it("treats an empty farm as no farm", () => {
    expect(
      registerSchema.parse({ ...validRegistration, farm: "" }).farm,
    ).toBeUndefined();
  });

  it("requires accepting the privacy policy", () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      privacyAccepted: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).privacyAccepted).toBe("privacyRequired");
    }
  });

  it.each([
    ["short", "passwordTooShort"],
    ["onlyletters", "passwordNeedsDigit"],
    ["12345678", "passwordNeedsLetter"],
  ])("rejects password %s with %s", (password, key) => {
    const result = registerSchema.safeParse({ ...validRegistration, password });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toBe(key);
  });

  it("rejects malformed phone numbers and farm slugs", () => {
    const phone = registerSchema.safeParse({
      ...validRegistration,
      phone: "abc",
    });
    expect(phone.success).toBe(false);
    const farm = registerSchema.safeParse({
      ...validRegistration,
      farm: "../x",
    });
    expect(farm.success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("rejects an invalid email with a translatable key", () => {
    const result = loginSchema.safeParse({ email: "nope", password: "x" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).email).toBe("emailInvalid");
    }
  });
});

describe("resetPasswordSchema", () => {
  it("requires both passwords to match", () => {
    const result = resetPasswordSchema.safeParse({
      password: "Domate2026",
      confirmPassword: "Domate2027",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).confirmPassword).toBe(
        "passwordsDontMatch",
      );
    }
  });
});
