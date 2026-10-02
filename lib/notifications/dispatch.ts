import "server-only";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import {
  ConsoleChannel,
  MailpitChannel,
  ResendEmailChannel,
} from "@/lib/notifications/channels";
import { processOutbox, type ProcessResult } from "@/lib/notifications/outbox";
import { createOutboxRepository } from "@/lib/notifications/repository";
import { renderOrderEmail } from "@/lib/notifications/templates";
import type { NotificationChannel } from "@/lib/notifications/types";
import en from "@/messages/en.json";
import sq from "@/messages/sq.json";

const DEFAULT_FROM = "Farm Orders <orders@example.com>";

/** Resend in production, Mailpit locally, console as a last resort. */
export function emailChannel(): NotificationChannel {
  const env = serverEnv();
  const from = env.EMAIL_FROM ?? DEFAULT_FROM;
  if (env.RESEND_API_KEY)
    return new ResendEmailChannel(env.RESEND_API_KEY, from);
  if (env.MAILPIT_URL) return new MailpitChannel(env.MAILPIT_URL, from);
  return new ConsoleChannel();
}

/**
 * Sends due notifications from the outbox. Never throws: notification
 * problems must not affect orders (D-22). Called via after() and by the cron.
 */
export async function dispatchNotifications(
  limit = 20,
): Promise<ProcessResult> {
  try {
    return await processOutbox(
      {
        repository: createOutboxRepository(),
        channel: emailChannel(),
        render: async (notification, order) =>
          renderOrderEmail(notification, order, {
            messages: notification.locale === "en" ? en : sq,
            siteUrl: publicEnv.NEXT_PUBLIC_SITE_URL,
          }),
      },
      limit,
    );
  } catch (error) {
    console.error("[notifications] dispatch failed", error);
    return { sent: 0, retried: 0, failed: 0 };
  }
}
