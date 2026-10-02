import type {
  NotificationChannel,
  OrderEmailData,
  OutboxNotification,
  OutgoingMessage,
} from "@/lib/notifications/types";

// Outbox processing, independent of Supabase so it can be unit-tested.

export const MAX_ATTEMPTS = 5;

/** Exponential backoff: 1, 2, 4, 8 … minutes, capped at 6 hours. */
export function retryDelayMs(attempts: number): number {
  return Math.min(2 ** Math.max(attempts - 1, 0), 360) * 60_000;
}

export type OutboxRepository = {
  /** Leases due notifications (attempts already incremented). */
  claim(limit: number): Promise<OutboxNotification[]>;
  loadOrder(orderId: string): Promise<OrderEmailData | null>;
  markSent(id: string): Promise<void>;
  markRetry(id: string, error: string, nextAttemptAt: Date): Promise<void>;
  markFailed(id: string, error: string): Promise<void>;
};

export type Renderer = (
  notification: OutboxNotification,
  order: OrderEmailData,
) => Promise<OutgoingMessage | null>;

export type ProcessResult = { sent: number; retried: number; failed: number };

export async function processOutbox(
  deps: {
    repository: OutboxRepository;
    channel: NotificationChannel;
    render: Renderer;
    now?: () => Date;
  },
  limit = 20,
): Promise<ProcessResult> {
  const { repository, channel, render } = deps;
  const now = deps.now ?? (() => new Date());
  const result: ProcessResult = { sent: 0, retried: 0, failed: 0 };

  for (const notification of await repository.claim(limit)) {
    try {
      const orderId = notification.payload.order_id;
      const order = orderId ? await repository.loadOrder(orderId) : null;
      const message = order ? await render(notification, order) : null;
      if (!message) {
        // Nothing sensible to send (unknown event or order gone): give up.
        await repository.markFailed(notification.id, "unrenderable");
        result.failed += 1;
        continue;
      }
      await channel.send(message);
      await repository.markSent(notification.id);
      result.sent += 1;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (notification.attempts >= MAX_ATTEMPTS) {
        await repository.markFailed(notification.id, reason);
        result.failed += 1;
      } else {
        await repository.markRetry(
          notification.id,
          reason,
          new Date(now().getTime() + retryDelayMs(notification.attempts)),
        );
        result.retried += 1;
      }
    }
  }
  return result;
}
