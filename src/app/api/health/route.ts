import { NextResponse } from "next/server";

/** Minimal probe: if this returns 200 but HTML routes 500, the fault is in page/RSC, not the Node process. */
export function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
