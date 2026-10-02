import { describe, expect, it } from "vitest";
import {
  addDays,
  dateInZone,
  defaultDeadline,
  isMonday,
  mondayOf,
  nextWeekToPrepare,
  utcToZoned,
  zonedToUtc,
} from "@/lib/farm/weeks";

const TZ = "Europe/Tirane";

describe("calendar helpers", () => {
  it("finds the Monday of a week", () => {
    expect(mondayOf("2026-10-05")).toBe("2026-10-05"); // Monday
    expect(mondayOf("2026-10-08")).toBe("2026-10-05"); // Thursday
    expect(mondayOf("2026-10-11")).toBe("2026-10-05"); // Sunday
    expect(mondayOf("2027-01-01")).toBe("2026-12-28"); // across the year
  });

  it("adds days across months and validates Mondays", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(isMonday("2026-10-05")).toBe(true);
    expect(isMonday("2026-10-06")).toBe(false);
    expect(isMonday("not-a-date")).toBe(false);
  });

  it("reads the calendar date in the farm's timezone", () => {
    // 23:30 UTC on Sunday is already Monday in Tirana (UTC+2 in summer).
    expect(dateInZone(new Date("2026-10-04T23:30:00Z"), TZ)).toBe("2026-10-05");
  });
});

describe("timezone conversion", () => {
  it("converts Tirana wall-clock time to UTC in summer and winter", () => {
    expect(zonedToUtc("2026-10-08", "20:00", TZ).toISOString()).toBe(
      "2026-10-08T18:00:00.000Z",
    );
    expect(zonedToUtc("2026-12-10", "20:00", TZ).toISOString()).toBe(
      "2026-12-10T19:00:00.000Z",
    );
  });

  it("round-trips through utcToZoned", () => {
    const instant = zonedToUtc("2026-10-29", "20:00", TZ); // week of DST end
    expect(utcToZoned(instant, TZ)).toEqual({
      date: "2026-10-29",
      time: "20:00",
    });
  });

  it("defaults the deadline to Thursday 20:00 local time", () => {
    expect(defaultDeadline("2026-10-05", TZ).toISOString()).toBe(
      "2026-10-08T18:00:00.000Z",
    );
  });
});

describe("nextWeekToPrepare", () => {
  it("is this week when nothing exists yet", () => {
    expect(nextWeekToPrepare(null, "2026-10-07")).toBe("2026-10-05");
  });

  it("is the week after the latest one", () => {
    expect(nextWeekToPrepare("2026-10-05", "2026-10-07")).toBe("2026-10-12");
  });

  it("never proposes a week that already started", () => {
    expect(nextWeekToPrepare("2026-09-07", "2026-10-07")).toBe("2026-10-12");
  });
});
