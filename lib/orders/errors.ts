import { toErrorKey, type ErrorKey } from "@/lib/i18n/errors";

export type PlaceOrderError = {
  code: ErrorKey;
  /** availability item the error refers to, if any. */
  itemId?: string;
  /** remaining stock for INSUFFICIENT_STOCK. */
  remaining?: number;
};

/**
 * Maps an error raised by place_order() (MESSAGE = stable code, DETAIL =
 * "<item id>[:<remaining>]") to something the UI can translate and highlight.
 */
export function parsePlaceOrderError(error: {
  message?: string;
  details?: string | null;
}): PlaceOrderError {
  const code = toErrorKey(error.message);
  const [itemId, remaining] = (error.details ?? "").split(":");
  return {
    code,
    ...(itemId ? { itemId } : {}),
    ...(remaining !== undefined && remaining !== ""
      ? { remaining: Number(remaining) }
      : {}),
  };
}
