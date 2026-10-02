import { expect, test } from "@playwright/test";
import { latestEmailLink, login, PASSWORD, users } from "./helpers";

test.describe("protected routes", () => {
  for (const path of ["/farm", "/admin", "/account"]) {
    test(`${path} redirects anonymous visitors to login`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(
        new RegExp(`/login\\?next=${encodeURIComponent(path)}`),
      );
    });
  }
});

test.describe("login", () => {
  test("farmer lands on the farm dashboard", async ({ page }) => {
    await login(page, users.farmerA);
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByText("Ferma Kodra e Gjelbër").first()).toBeVisible();
  });

  test("admin lands on the admin area", async ({ page }) => {
    await login(page, users.admin);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test("customer lands on the farm and cannot open farmer or admin pages", async ({
    page,
  }) => {
    await login(page, users.ana);
    await expect(page).toHaveURL(/\/f\/ferma-kodra$/);

    await page.goto("/farm");
    await expect(page).toHaveURL(/\/f\/ferma-kodra$/);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/f\/ferma-kodra$/);
  });

  test("login returns to the requested page", async ({ page }) => {
    await login(page, users.ana, "/account");
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByText("Përshëndetje, Ana!")).toBeVisible();
  });

  test("open redirects are ignored", async ({ page }) => {
    await login(page, users.ana, "//evil.example.com");
    await expect(page).toHaveURL(/localhost:\d+\/f\/ferma-kodra$/);
  });

  test("wrong password shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill(users.ana);
    await page.getByLabel("Fjalëkalimi").fill("WrongPassword1");
    await page.getByRole("button", { name: "Hyr", exact: true }).click();
    await expect(
      page.getByText("Email-i ose fjalëkalimi është i gabuar."),
    ).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue(users.ana);
  });
});

test("logout ends the session", async ({ page }) => {
  await login(page, users.ana, "/account");
  await page.getByRole("button", { name: "Ana" }).click();
  await page.getByRole("menuitem", { name: "Dil" }).click();
  await expect(page.getByRole("link", { name: "Hyr" })).toBeVisible();

  await page.goto("/account");
  await expect(page).toHaveURL(/\/login\?next=%2Faccount/);
});

test("customer registers from a farm page and confirms by e-mail", async ({
  page,
}, testInfo) => {
  const email = `e2e-${testInfo.project.name}-${Date.now()}@example.com`;

  await page.goto("/register?farm=ferma-kodra&next=%2Faccount");
  await page.getByLabel("Emri", { exact: true }).fill("Teuta");
  await page.getByLabel("Mbiemri").fill("Kola");
  await page.getByLabel("Telefoni").fill("069 555 1234");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Fjalëkalimi").fill(PASSWORD);

  // Missing consent is rejected and typed values are kept.
  await page.getByRole("button", { name: "Krijo llogarinë" }).click();
  await expect(
    page.getByText("Duhet të pranoni politikën e privatësisë."),
  ).toBeVisible();
  await expect(page.getByLabel("Emri", { exact: true })).toHaveValue("Teuta");

  await page.getByLabel("Fjalëkalimi").fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Krijo llogarinë" }).click();
  await expect(page.getByText("Kontrolloni email-in")).toBeVisible();

  const link = await latestEmailLink(email);
  await page.goto(link);
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByText("Përshëndetje, Teuta!")).toBeVisible();
});

test("auth pages are available in English", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();
  await page.getByRole("button", { name: "SQ" }).click();
  await expect(page).toHaveURL(/localhost:\d+\/login$/);
  await expect(
    page.getByRole("button", { name: "Hyr", exact: true }),
  ).toBeVisible();
});
