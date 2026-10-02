import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Password123";
export const MAILPIT_URL = process.env.MAILPIT_URL ?? "http://127.0.0.1:54324";

export const users = {
  admin: "admin@example.com",
  farmerA: "farmer.a@example.com",
  ana: "ana@example.com",
} as const;

/** Logs in through the real login form (Albanian UI). */
export async function login(page: Page, email: string, next?: string) {
  await page.goto(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Fjalëkalimi").fill(PASSWORD);
  await page.getByRole("button", { name: "Hyr", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

type MailpitSearch = { messages: { ID: string }[] };
type MailpitMessage = { HTML: string };

/** Waits for the newest e-mail to `to` in Mailpit and returns its first link. */
export async function latestEmailLink(to: string): Promise<string> {
  for (let attempt = 0; attempt < 30; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`,
    );
    const search = (await res.json()) as MailpitSearch;
    const id = search.messages?.[0]?.ID;
    if (id) {
      const msg = (await (
        await fetch(`${MAILPIT_URL}/api/v1/message/${id}`)
      ).json()) as MailpitMessage;
      const href = /href="([^"]+)"/.exec(msg.HTML)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No e-mail with a link arrived for ${to}`);
}

type MailpitSummary = { ID: string; Subject: string };

/** Waits until an e-mail to `to` whose subject contains `subject` arrives. */
export async function waitForEmail(
  to: string,
  subject: string,
): Promise<MailpitSummary> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await fetch(
      `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=50`,
    );
    const { messages } = (await res.json()) as { messages: MailpitSummary[] };
    const found = messages?.find((m) => m.Subject.includes(subject));
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No e-mail "${subject}" arrived for ${to}`);
}
