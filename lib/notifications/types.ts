// Notification abstraction (spec §17). A message is rendered once and handed
// to a channel; email is the only channel in the MVP, SMS / WhatsApp / push
// can be added as further NotificationChannel implementations.

export type OutgoingMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export interface NotificationChannel {
  readonly name: string;
  send(message: OutgoingMessage): Promise<void>;
}

export type NotificationEvent =
  "ORDER_PLACED_CUSTOMER" | "ORDER_PLACED_FARMER" | "ORDER_STATUS_CHANGED";

/** A row of the notifications outbox, as claimed for sending. */
export type OutboxNotification = {
  id: string;
  event: string;
  recipient: string;
  locale: "sq" | "en";
  payload: { order_id?: string; status?: string };
  attempts: number;
};

/** Everything a template needs about an order (read with the secret key). */
export type OrderEmailData = {
  orderId: string;
  orderNumber: number;
  status: string;
  deliveryMethod: "DELIVERY" | "PICKUP";
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  deliveryNotes: string | null;
  notes: string | null;
  cancelReason: string | null;
  weekStart: string;
  weekEnd: string;
  farm: {
    name: string;
    slug: string;
    phone: string | null;
    timezone: string;
    deliveryInformation: string | null;
    pickupInformation: string | null;
  };
  lines: {
    name: string;
    unitCode: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
};
