import { expect, test } from "@playwright/test";
import { adminPatch, currentItem } from "./db";
import { login } from "./helpers";

// Edge cases and flow efficiency for the customer order (spec §19: order in
// under 2–3 minutes). Desktop only: these change shared stock.
test.describe.configure({ mode: "serial" });
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "mutates shared stock");
});

test("stock running out during checkout can be fixed in one tap", async ({
  page,
}) => {
  await login(page, "erion@example.com");
  await page.goto("/f/ferma-kodra");
  const honey = page.locator("article").filter({ hasText: "Mjaltë mali" });
  await honey.getByRole("button", { name: "Shto", exact: true }).click();
  await honey.getByRole("button", { name: "Shto Mjaltë mali" }).click();
  await honey.getByRole("button", { name: "Shto Mjaltë mali" }).click(); // 3 jars
  await page.getByRole("button", { name: "Vazhdo", exact: true }).click();
  await page.getByRole("link", { name: "Vazhdo te porosia" }).click();
  await expect(
    page.getByRole("heading", { name: "Përfundo porosinë" }),
  ).toBeVisible();

  // Meanwhile other customers buy almost everything: only 1 jar left.
  const item = await currentItem("Mjaltë mali");
  await adminPatch(`availability_items?id=eq.${item.id}`, {
    available_quantity: Number(item.ordered_quantity) + 1,
  });

  await page.getByLabel("Marrje në fermë").check();
  await page.getByRole("button", { name: /Dërgo porosinë/ }).click();
  const alert = page.getByRole("alert").filter({ hasText: "Mjaltë mali" });
  await expect(alert).toContainText(
    "Mjaltë mali: Nuk ka mjaftueshëm nga një produkt.",
  );

  await alert.getByRole("button", { name: "Ndrysho në 1 copë" }).click();
  await page.getByRole("button", { name: /Dërgo porosinë/ }).click();
  await expect(
    page.getByRole("heading", { name: /Faleminderit!/ }),
  ).toBeVisible();
  await expect(page.getByText("1 copë ×")).toBeVisible();
});

test("a returning customer orders in a handful of steps", async ({ page }) => {
  // Logged in already (as most weekly customers are).
  await login(page, "fatjona@example.com");
  const navigations: string[] = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame())
      navigations.push(new URL(frame.url()).pathname);
  });
  let taps = 0;
  const tap = async (locator: ReturnType<typeof page.getByRole>) => {
    taps += 1;
    await locator.click();
  };

  const started = Date.now();
  await page.goto("/f/ferma-kodra");
  await tap(page.getByRole("button", { name: "Përsërit porosinë" })); // repeat last week
  await tap(page.getByRole("link", { name: "Vazhdo te porosia" }));
  await tap(page.getByRole("button", { name: /Dërgo porosinë/ }));
  await expect(
    page.getByRole("heading", { name: /Faleminderit!/ }),
  ).toBeVisible();

  // Farm page → checkout → confirmation; three taps with "Repeat order".
  expect(taps).toBe(3);
  expect(new Set(navigations).size).toBeLessThanOrEqual(3);
  expect(Date.now() - started).toBeLessThan(30_000);
});
