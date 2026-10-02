import { describe, expect, it, vi } from "vitest";
import {
  MailpitChannel,
  parseSender,
  ResendEmailChannel,
} from "@/lib/notifications/channels";
import {
  MAX_ATTEMPTS,
  processOutbox,
  retryDelayMs,
  type OutboxRepository,
} from "@/lib/notifications/outbox";
import { escapeHtml, renderOrderEmail } from "@/lib/notifications/templates";
import type {
  NotificationChannel,
  OrderEmailData,
  OutboxNotification,
  OutgoingMessage,
} from "@/lib/notifications/types";
import en from "@/messages/en.json";
import sq from "@/messages/sq.json";

const order: OrderEmailData = {
  orderId: "11111111-1111-4111-8111-111111111111",
  orderNumber: 1042,
  status: "PLACED",
  deliveryMethod: "DELIVERY",
  subtotal: 1910,
  deliveryFee: 200,
  total: 2110,
  currency: "ALL",
  customerName: "Sokol <b>Kreshpa</b>",
  customerPhone: "069 123 4567",
  deliveryAddress: "Rr. Myslym Shyri 12",
  deliveryCity: "Tiranë",
  deliveryNotes: null,
  notes: "Pa qese plastike",
  cancelReason: null,
  weekStart: "2026-10-05",
  weekEnd: "2026-10-11",
  farm: {
    name: "Ferma Kodra e Gjelbër",
    slug: "ferma-kodra",
    phone: "0691112233",
    timezone: "Europe/Tirane",
    deliveryInformation: null,
    pickupInformation: "Merreni në fermë të premten",
  },
  lines: [
    {
      name: "Domate",
      unitCode: "kg",
      quantity: 5,
      unitPrice: 250,
      total: 1250,
    },
    {
      name: "Sallatë",
      unitCode: "piece",
      quantity: 3,
      unitPrice: 100,
      total: 300,
    },
  ],
};

const notification = (
  overrides: Partial<OutboxNotification> = {},
): OutboxNotification => ({
  id: "n1",
  event: "ORDER_PLACED_CUSTOMER",
  recipient: "ana@example.com",
  locale: "sq",
  payload: { order_id: order.orderId },
  attempts: 1,
  ...overrides,
});

const render = (n: OutboxNotification, o: OrderEmailData = order) =>
  renderOrderEmail(n, o, {
    messages: n.locale === "en" ? en : sq,
    siteUrl: "https://farm.example.com",
  });

describe("renderOrderEmail", () => {
  it("renders the customer confirmation in Albanian", () => {
    const msg = render(notification())!;
    expect(msg.to).toBe("ana@example.com");
    expect(msg.subject).toBe("Porosia #1042 te Ferma Kodra e Gjelbër u dërgua");
    expect(msg.text).toContain("- Domate: 5 kg = 1 250 Lekë");
    expect(msg.text).toContain("- Sallatë: 3 copë");
    expect(msg.text).toContain("Totali: 2 110 Lekë");
    expect(msg.text).toContain("https://farm.example.com/account/orders/");
    expect(msg.text).toContain("0691112233");
  });

  it("renders in English with the /en prefix", () => {
    const msg = render(notification({ locale: "en" }))!;
    expect(msg.subject).toBe(
      "Order #1042 at Ferma Kodra e Gjelbër has been sent",
    );
    expect(msg.text).toContain("https://farm.example.com/en/account/orders/");
    expect(msg.text).toContain("3 pcs");
  });

  it("gives the farmer the customer's contact and a dashboard link", () => {
    const msg = render(
      notification({
        event: "ORDER_PLACED_FARMER",
        recipient: "farmer@example.com",
      }),
    )!;
    expect(msg.subject).toBe(
      "Porosi e re #1042 – Sokol <b>Kreshpa</b> – 2 110 Lekë",
    );
    expect(msg.text).toContain("069 123 4567");
    expect(msg.text).toContain("/farm/orders/");
    expect(msg.text).not.toContain("Pagesa"); // payment note is for customers
  });

  it("escapes user-provided text in HTML", () => {
    const msg = render(notification({ event: "ORDER_PLACED_FARMER" }))!;
    expect(msg.html).not.toContain("<b>Kreshpa</b>");
    expect(msg.html).toContain("Sokol &lt;b&gt;Kreshpa&lt;/b&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("words READY differently for pick-up and delivery", () => {
    const ready = notification({
      event: "ORDER_STATUS_CHANGED",
      payload: { order_id: order.orderId, status: "READY" },
    });
    expect(render(ready)!.text).toContain("do t'ju dërgohet");
    expect(
      render(ready, { ...order, deliveryMethod: "PICKUP" })!.text,
    ).toContain("gati për t'u marrë");
  });

  it("includes the cancellation reason", () => {
    const cancelled = notification({
      event: "ORDER_STATUS_CHANGED",
      payload: { order_id: order.orderId, status: "CANCELLED" },
    });
    const msg = render(cancelled, {
      ...order,
      cancelReason: "Mbaruan domatet",
    })!;
    expect(msg.subject).toBe("Porosia #1042: Anuluar");
    expect(msg.text).toContain("Arsyeja: Mbaruan domatet");
  });

  it("returns null for events without an e-mail", () => {
    expect(render(notification({ event: "SOMETHING_ELSE" }))).toBeNull();
    expect(
      render(
        notification({
          event: "ORDER_STATUS_CHANGED",
          payload: { order_id: order.orderId, status: "PREPARING" },
        }),
      ),
    ).toBeNull();
  });
});

function fakeRepository(items: OutboxNotification[]) {
  const calls: string[] = [];
  const repository: OutboxRepository = {
    claim: vi.fn(async () => items),
    loadOrder: vi.fn(async () => order),
    markSent: vi.fn(async (id) => void calls.push(`sent:${id}`)),
    markRetry: vi.fn(async (id) => void calls.push(`retry:${id}`)),
    markFailed: vi.fn(async (id) => void calls.push(`failed:${id}`)),
  };
  return { repository, calls };
}

const okChannel = (): NotificationChannel & { sent: OutgoingMessage[] } => {
  const sent: OutgoingMessage[] = [];
  return { name: "test", sent, send: async (m) => void sent.push(m) };
};

describe("processOutbox", () => {
  const renderer = async (n: OutboxNotification, o: OrderEmailData) =>
    render(n, o);

  it("sends claimed notifications and marks them sent", async () => {
    const { repository, calls } = fakeRepository([
      notification(),
      notification({ id: "n2", event: "ORDER_PLACED_FARMER" }),
    ]);
    const channel = okChannel();
    const result = await processOutbox({
      repository,
      channel,
      render: renderer,
    });
    expect(result).toEqual({ sent: 2, retried: 0, failed: 0 });
    expect(channel.sent).toHaveLength(2);
    expect(calls).toEqual(["sent:n1", "sent:n2"]);
  });

  it("schedules a retry with backoff when the provider fails", async () => {
    const { repository } = fakeRepository([notification({ attempts: 3 })]);
    const failing: NotificationChannel = {
      name: "x",
      send: async () => {
        throw new Error("503");
      },
    };
    const now = new Date("2026-10-05T10:00:00Z");
    const result = await processOutbox({
      repository,
      channel: failing,
      render: renderer,
      now: () => now,
    });
    expect(result.retried).toBe(1);
    expect(repository.markRetry).toHaveBeenCalledWith(
      "n1",
      "503",
      new Date(now.getTime() + 4 * 60_000),
    );
  });

  it("gives up after the maximum number of attempts", async () => {
    const { repository, calls } = fakeRepository([
      notification({ attempts: MAX_ATTEMPTS }),
    ]);
    const failing: NotificationChannel = {
      name: "x",
      send: async () => {
        throw new Error("down");
      },
    };
    const result = await processOutbox({
      repository,
      channel: failing,
      render: renderer,
    });
    expect(result.failed).toBe(1);
    expect(calls).toEqual(["failed:n1"]);
  });

  it("marks notifications without a renderable order as failed", async () => {
    const { repository, calls } = fakeRepository([
      notification({ payload: {} }),
    ]);
    await processOutbox({ repository, channel: okChannel(), render: renderer });
    expect(calls).toEqual(["failed:n1"]);
  });

  it("backs off exponentially up to six hours", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(120_000);
    expect(retryDelayMs(20)).toBe(360 * 60_000);
  });
});

describe("channels", () => {
  it("parses sender addresses", () => {
    expect(parseSender("Farm Orders <orders@example.com>")).toEqual({
      name: "Farm Orders",
      email: "orders@example.com",
    });
    expect(parseSender("orders@example.com")).toEqual({
      email: "orders@example.com",
    });
  });

  it("calls the Resend API with the message", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    await new ResendEmailChannel(
      "re_key",
      "Farm <f@example.com>",
      fetchMock as typeof fetch,
    ).send({
      to: "a@example.com",
      subject: "S",
      html: "<p>H</p>",
      text: "T",
    });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer re_key",
    );
    expect(JSON.parse(init.body as string)).toMatchObject({
      to: ["a@example.com"],
      subject: "S",
    });
  });

  it("throws on provider errors so the outbox retries", async () => {
    const fetchMock = vi.fn(async () => new Response("bad", { status: 500 }));
    await expect(
      new MailpitChannel(
        "http://mail",
        "f@example.com",
        fetchMock as typeof fetch,
      ).send({
        to: "a@example.com",
        subject: "S",
        html: "",
        text: "",
      }),
    ).rejects.toThrow("Mailpit 500");
  });
});
