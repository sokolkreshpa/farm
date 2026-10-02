import { expect, test } from "@playwright/test";

test("home opens the default farm in Albanian", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/f\/ferma-kodra$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "sq");
  await expect(
    page.getByRole("heading", { name: "Ferma Kodra e Gjelbër" }),
  ).toBeVisible();
});

test("English is available under /en", async ({ page }) => {
  await page.goto("/en/f/ferma-kodra");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Log in" })).toBeVisible();
});

test("unknown farms show the not-found page", async ({ page }) => {
  await page.goto("/f/no-such-farm");
  await expect(
    page.getByRole("heading", { name: "Faqja nuk u gjet" }),
  ).toBeVisible();
});
