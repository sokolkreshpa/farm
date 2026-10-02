import { expect, test } from "@playwright/test";
import { orderIdByNumber } from "./db";
import { latestEmailLink, login, PASSWORD } from "./helpers";

// Farmer flows. State-changing tests use farm B (ferma-fusha) so they never
// interfere with the customer specs on farm A. Expects a freshly seeded DB
// (`npm run test:e2e:fresh`). Desktop project only, in order.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "farmer flows run once");
});

// 1×1 transparent PNG.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

test.describe("farm A (read-mostly)", () => {
  test("dashboard shows this week at a glance", async ({ page }) => {
    await login(page, "farmer.a@example.com");
    await expect(page).toHaveURL(/\/farm$/);
    await expect(page.getByRole("heading", { name: "Kjo javë" })).toBeVisible();
    await expect(page.getByText("Shitje të pritura")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Menaxho produktet e javës" }),
    ).toBeVisible();
    await expect(page.getByText("/f/ferma-kodra")).toBeVisible();
  });

  test("week editor refuses quantities below what was ordered", async ({
    page,
  }) => {
    await login(page, "farmer.a@example.com", "/farm/week");
    await expect(page).toHaveURL(/\/farm\/weeks\/[0-9a-f-]+$/);
    const oil = page.getByRole("listitem").filter({ hasText: "Vaj ulliri" });
    const quantity = oil.getByLabel("Sasia");
    await quantity.fill("0");
    await quantity.blur();
    await expect(oil.getByRole("alert")).toHaveText(
      "Sasia nuk mund të jetë më e vogël se sa është porositur tashmë.",
    );
  });

  test("farmer creates a product with a photo", async ({ page }) => {
    const name = `Rrush ${Date.now()}`;
    await login(page, "farmer.a@example.com", "/farm/products/new");
    await page.getByLabel("Emri").fill(name);
    await page.getByLabel("Kategoria").fill("Fruta");
    await page.getByLabel("Njësia").selectOption("kg");
    await page
      .getByLabel("Foto")
      .setInputFiles({ name: "rrush.png", mimeType: "image/png", buffer: PNG });
    await page.getByRole("button", { name: "Ruaj produktin" }).click();

    await expect(page).toHaveURL(/\/farm\/products$/);
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toContainText("Fruta · kg");
    await expect(row.getByRole("img", { name })).toBeVisible();
  });

  test("farmer keeps private notes about a customer", async ({ page }) => {
    await login(page, "farmer.a@example.com", "/farm/customers");
    await page.getByRole("link", { name: /Bledi Shehu/ }).click();
    await page.getByLabel("Shënime private").fill("Preferon domate jeshile");
    await page.getByRole("button", { name: "Ruaj" }).click();
    await expect(page.getByRole("status")).toHaveText("U ruajt");
  });

  test("farmer A cannot open farm B's orders", async ({ page }) => {
    const farmBOrder = await orderIdByNumber("ferma-fusha", 1001);
    await login(page, "farmer.a@example.com");
    await page.goto(`/farm/orders/${farmBOrder}`);
    await expect(
      page.getByRole("heading", { name: "Faqja nuk u gjet" }),
    ).toBeVisible();
  });
});

test.describe("farm B (processing and publishing)", () => {
  test("totals show how much to prepare", async ({ page }) => {
    await login(page, "farmer.b@example.com", "/farm/orders");
    await expect(
      page.getByRole("heading", { name: "Totalet e javës" }),
    ).toBeVisible();
    const milk = page.getByRole("row", { name: /Qumësht lope/ });
    await expect(milk).toContainText("4 l");
    await expect(milk).toContainText("(1 porosi)");
  });

  test("farmer moves an order through its statuses", async ({ page }) => {
    await login(page, "farmer.b@example.com", "/farm/orders?tab=list");
    await page.getByRole("link", { name: /#1001 · Gent Prifti/ }).click();
    await expect(page.getByText("Lagjja Apollonia, P. 4, Fier")).toBeVisible();

    await page.getByRole("button", { name: "Shëno si “Konfirmuar”" }).click();
    await expect(
      page.getByRole("button", { name: "Shëno si “Në përgatitje”" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Gati", exact: true }).click(); // skip ahead
    await expect(
      page.getByRole("button", { name: "Shëno si “Dorëzuar”" }),
    ).toBeVisible();

    const history = page.getByRole("region", { name: "Historiku" });
    await expect(history).toContainText("Konfirmuar");
    await expect(history).toContainText("Gati");
  });

  test("farmer copies last week, edits a price and publishes", async ({
    page,
  }) => {
    await login(page, "farmer.b@example.com", "/farm/weeks");
    await page.getByRole("button", { name: "Kopjo javën e kaluar" }).click();
    await expect(page).toHaveURL(/\/farm\/weeks\/[0-9a-f-]+$/);
    await expect(page.getByText("Pa publikuar")).toBeVisible();

    const milk = page.getByRole("listitem").filter({ hasText: "Qumësht lope" });
    const price = milk.getByLabel("Çmimi");
    await expect(price).toHaveValue("120");
    await price.fill("130");
    await price.blur();
    await expect(milk.getByLabel("U ruajt")).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Publiko javën" }).click();
    await expect(page.getByText("E publikuar")).toBeVisible();

    // Customers now see the new week and the new price.
    await page.goto("/f/ferma-fusha");
    await expect(
      page.locator("article").filter({ hasText: "Qumësht lope" }),
    ).toContainText("130");
  });
});

test("admin creates a farm and the invited farmer sets a password", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop");
  const stamp = Date.now();
  const slug = `ferma-test-${stamp}`;
  const farmerEmail = `farmer-${stamp}@example.com`;

  await login(page, "admin@example.com");
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText("Ferma Kodra e Gjelbër")).toBeVisible();

  await page.getByRole("link", { name: "Fermë e re" }).click();
  await page.getByLabel("Emri i fermës").fill(`Ferma Test ${stamp}`);
  await expect(page.getByLabel("Adresa në internet")).toHaveValue(
    `ferma-test-${stamp}`,
  );
  await page.getByLabel("Emri", { exact: true }).fill("Dritan");
  await page.getByLabel("Email i fermerit").fill(farmerEmail);
  await page
    .getByRole("button", { name: "Krijo fermën dhe dërgo ftesën" })
    .click();

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(`/f/${slug}`)).toBeVisible();

  // The farmer follows the invite e-mail and chooses a password.
  await page.context().clearCookies();
  await page.goto(await latestEmailLink(farmerEmail));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("Fjalëkalimi i ri").fill(PASSWORD);
  await page.getByLabel("Përsërit fjalëkalimin").fill(PASSWORD);
  await page.getByRole("button", { name: "Ruaj fjalëkalimin" }).click();
  await page.getByRole("link", { name: "Vazhdo" }).click();
  await expect(page).toHaveURL(/\/farm$/);
  await expect(page.getByRole("banner")).toContainText(`Ferma Test ${stamp}`);
});
