import { createTranslator } from "next-intl";
import { routing } from "@/i18n/routing";
import { formatMoney, formatQuantity } from "@/lib/format";
import type {
  OrderEmailData,
  OutboxNotification,
  OutgoingMessage,
} from "@/lib/notifications/types";
import type messagesType from "@/messages/en.json";

type Messages = typeof messagesType;

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function localePath(locale: string, path: string): string {
  return locale === routing.defaultLocale ? path : `/${locale}${path}`;
}

/**
 * Renders an outbox notification into an e-mail in the recipient's language.
 * Pure: messages and site URL are passed in (testable, no request context).
 */
export function renderOrderEmail(
  notification: OutboxNotification,
  order: OrderEmailData,
  options: { messages: Messages; siteUrl: string },
): OutgoingMessage | null {
  const locale = notification.locale;
  const { messages, siteUrl } = options;
  const t = createTranslator({ locale, messages, namespace: "Emails" });
  const tUnits = createTranslator({ locale, messages, namespace: "Units" });
  const tStatus = createTranslator({
    locale,
    messages,
    namespace: "OrderStatus",
  });
  const tMethod = createTranslator({
    locale,
    messages,
    namespace: "DeliveryMethod",
  });

  const unit = (code: string) =>
    code in messages.Units ? tUnits(code as keyof Messages["Units"]) : code;
  const money = (amount: number) => formatMoney(amount, order.currency, locale);
  const day = (date: string) =>
    new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(`${date}T12:00:00Z`));
  const vars = {
    number: order.orderNumber,
    farm: order.farm.name,
    customer: order.customerName,
    total: money(order.total),
  };

  let subject: string;
  let intro: string;
  let link: { href: string; label: string };
  let audience: "customer" | "farmer" = "customer";

  switch (notification.event) {
    case "ORDER_PLACED_CUSTOMER":
      subject = t("placedCustomer.subject", vars);
      intro = t("placedCustomer.intro", vars);
      link = {
        href: localePath(locale, `/account/orders/${order.orderId}`),
        label: t("viewOrder"),
      };
      break;
    case "ORDER_PLACED_FARMER":
      audience = "farmer";
      subject = t("placedFarmer.subject", vars);
      intro = t("placedFarmer.intro", vars);
      link = {
        href: localePath(locale, `/farm/orders/${order.orderId}`),
        label: t("openInApp"),
      };
      break;
    case "ORDER_STATUS_CHANGED": {
      const status = notification.payload.status ?? order.status;
      const key =
        status === "READY"
          ? order.deliveryMethod === "DELIVERY"
            ? "READY_DELIVERY"
            : "READY_PICKUP"
          : status;
      if (
        ![
          "CONFIRMED",
          "READY_DELIVERY",
          "READY_PICKUP",
          "DELIVERED",
          "CANCELLED",
        ].includes(key)
      ) {
        return null;
      }
      subject = t("status.subject", {
        number: order.orderNumber,
        status: tStatus(status as keyof Messages["OrderStatus"]),
      });
      intro = t(`status.${key as "CONFIRMED"}`, vars);
      if (status === "CANCELLED" && order.cancelReason) {
        intro += ` ${t("status.reason", { reason: order.cancelReason })}`;
      }
      link = {
        href: localePath(locale, `/account/orders/${order.orderId}`),
        label: t("viewOrder"),
      };
      break;
    }
    default:
      return null;
  }

  const url = new URL(link.href, siteUrl).toString();
  const where =
    order.deliveryMethod === "DELIVERY"
      ? [order.deliveryAddress, order.deliveryCity].filter(Boolean).join(", ")
      : (order.farm.pickupInformation ?? "");

  const rows = order.lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 0;border-bottom:1px solid #eee4d6">${escapeHtml(l.name)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee4d6;text-align:right;white-space:nowrap">${escapeHtml(formatQuantity(l.quantity, locale))} ${escapeHtml(unit(l.unitCode))}</td>
        <td style="padding:6px 0;border-bottom:1px solid #eee4d6;text-align:right;white-space:nowrap">${escapeHtml(money(l.total))}</td>
      </tr>`,
    )
    .join("");

  const detail = (label: string, value: string | null | undefined) =>
    value
      ? `<p style="margin:4px 0"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</p>`
      : "";

  const html = `<!doctype html>
<html lang="${locale}">
  <body style="margin:0;padding:24px;background:#faf7f0;font-family:Arial,Helvetica,sans-serif;color:#3a3127">
    <table role="presentation" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px">
      <tr><td>
        <p style="margin:0 0 4px;color:#3f7a4a;font-weight:bold">${escapeHtml(order.farm.name)}</p>
        <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(subject)}</h1>
        <p style="font-size:15px;line-height:1.5">${escapeHtml(intro)}</p>
        ${audience === "farmer" ? detail(t("customer"), `${order.customerName} · ${order.customerPhone}`) : ""}
        ${detail(t("week"), `${day(order.weekStart)} – ${day(order.weekEnd)}`)}
        ${detail(tMethod(order.deliveryMethod), where)}
        ${detail(t("deliveryNotes"), order.deliveryNotes)}
        ${detail(t("notes"), order.notes)}
        <table role="presentation" width="100%" style="margin:16px 0;border-collapse:collapse;font-size:14px">
          ${rows}
          ${order.deliveryMethod === "DELIVERY" ? `<tr><td style="padding:6px 0">${escapeHtml(t("deliveryFee"))}</td><td></td><td style="padding:6px 0;text-align:right">${escapeHtml(money(order.deliveryFee))}</td></tr>` : ""}
          <tr><td style="padding:8px 0;font-weight:bold">${escapeHtml(t("total"))}</td><td></td><td style="padding:8px 0;text-align:right;font-weight:bold">${escapeHtml(money(order.total))}</td></tr>
        </table>
        ${audience === "customer" ? `<p style="font-size:14px;color:#7a7066">${escapeHtml(t("payment"))}</p>` : ""}
        <p style="margin:24px 0"><a href="${escapeHtml(url)}" style="background:#3f7a4a;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(link.label)}</a></p>
        ${audience === "customer" && order.farm.phone ? `<p style="font-size:14px">${escapeHtml(t("changes", { phone: order.farm.phone }))}</p>` : ""}
        <p style="font-size:12px;color:#9a9086;margin-top:24px">${escapeHtml(t("footer", { farm: order.farm.name }))}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const text = [
    order.farm.name,
    subject,
    "",
    intro,
    audience === "farmer"
      ? `${t("customer")}: ${order.customerName} · ${order.customerPhone}`
      : "",
    `${t("week")}: ${day(order.weekStart)} – ${day(order.weekEnd)}`,
    where ? `${tMethod(order.deliveryMethod)}: ${where}` : "",
    order.notes ? `${t("notes")}: ${order.notes}` : "",
    "",
    ...order.lines.map(
      (l) =>
        `- ${l.name}: ${formatQuantity(l.quantity, locale)} ${unit(l.unitCode)} = ${money(l.total)}`,
    ),
    order.deliveryMethod === "DELIVERY"
      ? `${t("deliveryFee")}: ${money(order.deliveryFee)}`
      : "",
    `${t("total")}: ${money(order.total)}`,
    "",
    `${link.label}: ${url}`,
    audience === "customer" && order.farm.phone
      ? t("changes", { phone: order.farm.phone })
      : "",
  ]
    .filter((line, i, all) => line !== "" || all[i - 1] !== "")
    .join("\n");

  return { to: notification.recipient, subject, html, text };
}
