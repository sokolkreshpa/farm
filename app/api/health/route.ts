import { NextResponse } from "next/server";

// Liveness check for uptime monitoring.
export function GET() {
  return NextResponse.json({ ok: true });
}
