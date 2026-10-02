import { expect, test, type Page } from "@playwright/test";
import { formatMoney } from "../../lib/format";
import { orderIdByNumber } from "./db";
import { login } from "./helpers";

const FARM = "/f/ferma-kodra";

// Same formatter as the app ("290 Lekë" with a no-break space).
const lek = (amount: number) => formatMoney(amount, "ALL", "sq");

function card(page: Page, name: string) {
  return page.locator("article").filter({
    has: page.getByRole("heading", { name, exact: true }),
  });
}

async function openCartAndCheckout(page: Page) {
  await page.getByRole("button", { name: "Vazhdo", exact: true }).click();
  await page.getByRole("link", { name: "Vazhdo te porosia" }).click();
}

test.describe("weekly shop", () => {
  test("anonymous visitors browse this week's products", async ({ page }) => {
    await page.goto(FARM);
    await expect(
      page.getByRole("heading", { name: "Produktet e freskëta të kësaj jave" }),
    ).toBeVisible();
    await expect(page.getByText("Porositë mbyllen")).toBeVisible();
    await expect(card(page, "Domate")).toContainText(`${lek(250)} / kg`);
    // Apples were offered last week only.
    await expect(card(page, "Mollë")).toHaveCount(0);
  });

  test("cart persists and checkout asks anonymous visitors to sign up", async ({
    page,
  }) => {
    await page.goto(FARM);
    await card(page, "Domate")
      .getByRole("button", { name: "Shto", exact: true })
      .click();
    await card(page, "Domate")
      .getByRole("button", { name: "Shto Domate" })
      .click();
    await expect(card(page, "Domate").getByRole("status")).toHaveText("1 kg");
    await expect(page.getByText(`1 produkt · ${lek(250)}`)).toBeVisible();

    await page.reload();
    await expect(page.getByText(`1 produkt · ${lek(250)}`)).toBeVisible();

    await openCartAndCheckout(page);
    await expect(page).toHaveURL(/\/register\?farm=ferma-kodra&next=/);
  });

  test("per-customer maximum caps the quantity", async ({ page }) => {
    await page.goto(FARM);
    const eggs = card(page, "Vezë fshati");
    await expect(eggs).toContainText("Maksimumi 3 duzinë për klient");
    await eggs.getByRole("button", { name: "Shto", exact: true }).click();
    const more = eggs.getByRole("button", { name: "Shto Vezë fshati" });
    await more.click();
    await more.click();
    await expect(eggs.getByRole("status")).toHaveText("3 duzinë");
    await expect(more).toBeDisabled();
  });
});

test.describe("checkout", () => {
  test("customer places a pickup order and sees the confirmation", async ({
    page,
  }) => {
    await login(page, "fatjona@example.com");
    await page.goto(FARM);
    await card(page, "Domate")
      .getByRole("button", { name: "Shto", exact: true })
      .click();
    await card(page, "Domate")
      .getByRole("button", { name: "Shto Domate" })
      .click();
    await card(page, "Kastravec")
      .getByRole("button", { name: "Shto", exact: true })
      .click();
    await openCartAndCheckout(page);

    await expect(page).toHaveURL(/\/f\/ferma-kodra\/checkout$/);
    await expect(page.getByLabel("Marrje në fermë")).toBeChecked();
    await page.getByLabel("Shënim për fermerin").fill("Pa qese plastike");
    await page
      .getByRole("button", { name: `Dërgo porosinë · ${lek(340)}` })
      .click();

    await expect(page).toHaveURL(/\/account\/orders\/[0-9a-f-]+\?placed=1$/);
    await expect(
      page.getByRole("heading", {
        name: /Faleminderit! Porosia #\d+ u dërgua\./,
      }),
    ).toBeVisible();
    await expect(page.getByText("Pa qese plastike")).toBeVisible();
    await expect(page.getByText(lek(340)).last()).toBeVisible();
    await expect(page.getByText("0691112233")).toBeVisible(); // farm phone for changes

    // The cart is emptied after ordering.
    await page.goto(FARM);
    await expect(page.getByText(/produkte? ·/)).toHaveCount(0);
  });

  test("delivery to a saved address adds the delivery fee", async ({
    page,
  }) => {
    await login(page, "drita@example.com");
    await page.goto(FARM);
    await card(page, "Patate")
      .getByRole("button", { name: "Shto", exact: true })
      .click();
    await openCartAndCheckout(page);

    await expect(page.getByLabel("Dërgesë në shtëpi")).toBeChecked();
    await expect(page.getByLabel(/Rr\. Ibrahim Rugova 7/)).toBeChecked();
    // 1 kg potatoes (90) + delivery (200)
    await page
      .getByRole("button", { name: `Dërgo porosinë · ${lek(290)}` })
      .click();
    await expect(
      page.getByRole("heading", { name: /Faleminderit!/ }),
    ).toBeVisible();
    await expect(page.getByText("Rr. Ibrahim Rugova 7, Tiranë")).toBeVisible();
  });
});

test.describe("order history and repeat", () => {
  test("repeat an old order: unavailable products are flagged", async ({
    page,
  }) => {
    await login(page, "ana@example.com", "/account/orders");
    const oldOrder = page
      .getByRole("listitem")
      .filter({ hasText: "Porosia #1001" });
    await oldOrder.getByRole("link", { name: "Përsërit" }).click();

    await expect(page).toHaveURL(/\/f\/ferma-kodra\?repeat=/);
    const repeat = page.getByRole("region", { name: "Porosia juaj e fundit" });
    await expect(repeat).toContainText("Mollë");
    await expect(repeat).toContainText("nuk ofrohet këtë javë");
    await expect(repeat).toContainText(`tani ${lek(250)}`); // tomatoes were 220 last week

    await repeat.getByRole("button", { name: "Përsërit porosinë" }).click();
    const cart = page.getByRole("dialog");
    await expect(cart).toContainText("Domate");
    await expect(cart).toContainText("Sallatë jeshile");
    await expect(cart).not.toContainText("Mollë");
  });

  test("customers cannot open someone else's order", async ({ page }) => {
    const bledisOrder = await orderIdByNumber("ferma-kodra", 1002);
    await login(page, "ana@example.com");
    await page.goto(`/account/orders/${bledisOrder}`);
    await expect(
      page.getByRole("heading", { name: "Faqja nuk u gjet" }),
    ).toBeVisible();
  });
});

test("customer manages addresses on the account page", async ({
  page,
}, testInfo) => {
  const street = `Rr. Testi ${testInfo.project.name} ${Date.now()}`;
  await login(page, "erion@example.com", "/account");
  await page.getByLabel("Rruga dhe numri").fill(street);
  await page.getByLabel("Qyteti").fill("Durrës");
  await page.getByRole("button", { name: "Shto adresë" }).click();
  const added = page.getByRole("listitem").filter({ hasText: street });
  await expect(added).toBeVisible();
  await added.getByRole("button", { name: "Fshi" }).click();
  await expect(added).toHaveCount(0);
});
