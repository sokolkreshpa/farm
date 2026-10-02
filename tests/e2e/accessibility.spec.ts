import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Automated WCAG 2.1 A/AA checks on the key screens (spec §19: accessible).
// axe catches roughly a third of issues; keyboard and screen-reader checks
// are still done manually.

async function expectNoViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal") // Next.js dev overlay
    .analyze();
  const serious = results.violations.filter((v) =>
    ["serious", "critical"].includes(v.impact ?? ""),
  );
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    ),
  ).toEqual([]);
}

test.describe("customer screens", () => {
  for (const path of [
    "/f/ferma-kodra",
    "/login",
    "/register",
    "/privacy",
    "/en/f/ferma-kodra",
  ]) {
    test(`${path} has no serious accessibility violations`, async ({
      page,
    }) => {
      await page.goto(path);
      await expectNoViolations(page);
    });
  }

  test("cart drawer and checkout have no serious violations", async ({
    page,
  }) => {
    await login(page, "erion@example.com");
    await page.goto("/f/ferma-kodra");
    await page
      .locator("article")
      .filter({ hasText: "Karota" })
      .getByRole("button", { name: "Shto", exact: true })
      .click();
    await page.getByRole("button", { name: "Vazhdo", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expectNoViolations(page);

    await page.getByRole("link", { name: "Vazhdo te porosia" }).click();
    await expect(
      page.getByRole("heading", { name: "Përfundo porosinë" }),
    ).toBeVisible();
    await expectNoViolations(page);

    await page.goto("/account/orders");
    await expectNoViolations(page);
  });
});

test.describe("farmer screens", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "checked once");
  });

  for (const path of [
    "/farm",
    "/farm/week",
    "/farm/orders",
    "/farm/orders?tab=list",
    "/farm/products",
    "/farm/customers",
    "/farm/settings",
  ]) {
    test(`${path} has no serious accessibility violations`, async ({
      page,
    }) => {
      await login(page, "farmer.a@example.com", path);
      await expectNoViolations(page);
    });
  }
});
