import type {
  NotificationChannel,
  OutgoingMessage,
} from "@/lib/notifications/types";

/** Parses `"Farm Orders <orders@example.com>"` into name and address. */
export function parseSender(from: string): { name?: string; email: string } {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from);
  return match
    ? { name: match[1] || undefined, email: match[2] }
    : { email: from.trim() };
}

/** Production: Resend HTTP API (no SDK dependency needed). */
export class ResendEmailChannel implements NotificationChannel {
  readonly name = "resend";
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    const res = await this.fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!res.ok) {
      throw new Error(
        `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }
}

/** Local development: Mailpit's HTTP send API (http://127.0.0.1:54324). */
export class MailpitChannel implements NotificationChannel {
  readonly name = "mailpit";
  constructor(
    private readonly baseUrl: string,
    private readonly from: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(message: OutgoingMessage): Promise<void> {
    const sender = parseSender(this.from);
    const res = await this.fetchImpl(
      `${this.baseUrl.replace(/\/$/, "")}/api/v1/send`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          From: { Email: sender.email, Name: sender.name ?? "" },
          To: [{ Email: message.to }],
          Subject: message.subject,
          HTML: message.html,
          Text: message.text,
        }),
      },
    );
    if (!res.ok) {
      throw new Error(
        `Mailpit ${res.status}: ${(await res.text()).slice(0, 300)}`,
      );
    }
  }
}

/** Fallback when no provider is configured: logs instead of sending. */
export class ConsoleChannel implements NotificationChannel {
  readonly name = "console";
  async send(message: OutgoingMessage): Promise<void> {
    console.info(
      `[notifications] (not sent) to=${message.to} subject=${message.subject}`,
    );
  }
}
