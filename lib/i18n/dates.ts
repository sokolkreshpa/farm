import "server-only";
import { getFormatter } from "next-intl/server";

/**
 * Date formatters for Server Components, in a farm's timezone and with the
 * 24-hour clock (D-53). Calendar dates ("YYYY-MM-DD") are timezone-free.
 */
export async function getDateFormatters(timeZone: string) {
  const format = await getFormatter();
  return {
    /** "5 tetor" from "2026-10-05". */
    day: (date: string) =>
      format.dateTime(new Date(`${date}T12:00:00Z`), {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }),
    /** "e enjte, 8 tetor 20:00". */
    deadline: (iso: string) =>
      format.dateTime(new Date(iso), {
        timeZone,
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    /** "8 tetor, 14:05". */
    dateTime: (iso: string) =>
      format.dateTime(new Date(iso), {
        timeZone,
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }),
    /** "8 tetor 2026". */
    date: (iso: string) =>
      format.dateTime(new Date(iso), {
        timeZone,
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  };
}
