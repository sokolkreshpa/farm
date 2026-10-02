import { expect, test } from "@playwright/test";
import { login, waitForEmail } from "./helpers";

// End-to-end e-mail flow through the outbox into Mailpit (local SMTP sink).
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "e-mail flow runs once");
});

test("order and status changes send e-mails to customer and farmer", async ({
  browser,
}) => {
  // Customer places an order.
  const customer = await browser.newPage();
  await login(customer, "bledi@example.com");
  await customer.goto("/f/ferma-kodra");
  await customer
    .locator("article")
    .filter({ hasText: "Qepë" })
    .getByRole("button", { name: "Shto", exact: true })
    .click();
  await customer.getByRole("button", { name: "Vazhdo", exact: true }).click();
  await customer.getByRole("link", { name: "Vazhdo te porosia" }).click();
  await customer.getByLabel("Marrje në fermë").check();
  await customer.getByRole("button", { name: /Dërgo porosinë/ }).click();
  const heading = customer.getByRole("heading", {
    name: /Faleminderit! Porosia #\d+/,
  });
  await expect(heading).toBeVisible();
  const orderNumber = /#(\d+)/.exec((await heading.textContent()) ?? "")![1];

  await waitForEmail(
    "bledi@example.com",
    `Porosia #${orderNumber} te Ferma Kodra e Gjelbër u dërgua`,
  );
  await waitForEmail(
    "farmer.a@example.com",
    `Porosi e re #${orderNumber} – Bledi Shehu`,
  );

  // Farmer confirms it; the customer is notified.
  const farmer = await browser.newPage();
  await login(farmer, "farmer.a@example.com", "/farm/orders?tab=list");
  await farmer
    .getByRole("link", { name: new RegExp(`#${orderNumber} · Bledi Shehu`) })
    .click();
  await farmer.getByRole("button", { name: "Shëno si “Konfirmuar”" }).click();
  await expect(
    farmer.getByRole("button", { name: "Shëno si “Në përgatitje”" }),
  ).toBeVisible();

  await waitForEmail(
    "bledi@example.com",
    `Porosia #${orderNumber}: Konfirmuar`,
  );
});
