import { NextRequest, NextResponse } from "next/server";
import { runDiscover, runDataSync } from "@/app/api/dbu-sync/route";

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await runDiscover();
    const synced = await runDataSync();
    return NextResponse.json({ ok: true, synced, timestamp: new Date().toISOString() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
