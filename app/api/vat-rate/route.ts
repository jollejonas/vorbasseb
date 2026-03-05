import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const setting = await prisma.siteSetting.findUnique({ where: { key: "vat_rate" } });
  const vatPct = parseInt(setting?.value ?? "25", 10);
  return NextResponse.json({ vatPct });
}
