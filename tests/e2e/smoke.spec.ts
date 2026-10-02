import { expect, test } from "@playwright/test";

test("home page renders in Albanian by default", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "sq");
  await expect(
    page.getByRole("heading", { name: "Produktet e freskëta të kësaj jave" }),
  ).toBeVisible();
});

test("English is available under /en", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { name: "This week's fresh products" }),
  ).toBeVisible();
});
