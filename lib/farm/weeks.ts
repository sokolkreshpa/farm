// Calendar maths for ordering weeks, in the farm's timezone, without a date
// library. Dates are "YYYY-MM-DD" strings; weeks start on Monday (D-12).

/** Calendar date ("YYYY-MM-DD") of `instant` in `timeZone`. */
export function dateInZone(instant: Date, timeZone: string): string {
  const parts = zonedParts(instant, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
  return addDays(date, -((weekday + 6) % 7));
}

export function isMonday(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && mondayOf(date) === date;
}

/** The instant of local `date` + `time` ("HH:mm") in `timeZone` (DST-safe). */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  // Two passes handle instants close to a DST change.
  let guess = wallClockAsUtc - offsetMs(new Date(wallClockAsUtc), timeZone);
  guess = wallClockAsUtc - offsetMs(new Date(guess), timeZone);
  return new Date(guess);
}

/** Local date and time of `instant`, e.g. for a datetime-local input. */
export function utcToZoned(
  instant: Date,
  timeZone: string,
): { date: string; time: string } {
  const p = zonedParts(instant, timeZone);
  return {
    date: `${p.year}-${pad(p.month)}-${pad(p.day)}`,
    time: `${pad(p.hour)}:${pad(p.minute)}`,
  };
}

/** Default deadline for a week: Thursday 20:00 local time. */
export function defaultDeadline(weekStart: string, timeZone: string): Date {
  return zonedToUtc(addDays(weekStart, 3), "20:00", timeZone);
}

/**
 * The week a farmer should prepare next: the week after the latest existing
 * one, but never a week that has already started.
 */
export function nextWeekToPrepare(
  latestWeekStart: string | null,
  today: string,
): string {
  const thisMonday = mondayOf(today);
  if (!latestWeekStart) return thisMonday;
  const following = addDays(latestWeekStart, 7);
  return following > thisMonday ? following : addDays(thisMonday, 7);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

type Parts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const partFormatters = new Map<string, Intl.DateTimeFormat>();

function zonedParts(instant: Date, timeZone: string): Parts {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    partFormatters.set(timeZone, formatter);
  }
  const values: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour % 24,
    minute: values.minute,
    second: values.second,
  };
}

/** Offset of `timeZone` from UTC at `instant`, in milliseconds. */
function offsetMs(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}
