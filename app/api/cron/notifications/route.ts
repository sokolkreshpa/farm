import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env.server";
import { dispatchNotifications } from "@/lib/notifications/dispatch";

// Retries notifications that could not be sent right after the request
// (provider outage etc.). Called by Vercel Cron with
// "Authorization: Bearer $CRON_SECRET".

function authorized(request: NextRequest): boolean {
  const secret = serverEnv().CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await dispatchNotifications(100);
  return NextResponse.json(result);
}
