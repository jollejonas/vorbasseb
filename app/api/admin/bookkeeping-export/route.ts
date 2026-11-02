import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { bookkeepingCsv, exportPeriod, paidOrderStatuses } from "@/lib/bookkeeping-export";
import type { OrderStatus } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Ingen adgang." }, { status: 403 });
  const from = req.nextUrl.searchParams.get("from") ?? "";
  const to = req.nextUrl.searchParams.get("to") ?? "";
  let period;
  try { period = exportPeriod(from, to); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Ugyldig periode." }, { status: 400 }); }
  const orders = await prisma.order.findMany({
    where: {
      createdAt: period, orderNumber: { not: null }, NOT: { status: "PENDING" },
      OR: [
        { status: { in: [...paidOrderStatuses, "REFUNDED"] as OrderStatus[] } },
        { refunded: true },
        { status: "CANCELLED", stripePaymentId: { not: null } },
      ],
    },
    select: {
      id: true, orderNumber: true, createdAt: true, customerName: true, status: true, refunded: true,
      total: true, discountApplied: true, shippingFee: true, stripePaymentId: true, stripeSessionId: true, groupOrderHoldUntil: true,
      items: { select: { quantity: true, optionSelections: true, sku: { select: { size: true, product: { select: { name: true } } } } } },
    },
    orderBy: [{ createdAt: "asc" }, { orderNumber: "asc" }],
    take: 10001,
  });
  if (orders.length > 10000) return NextResponse.json({ error: "Perioden indeholder over 10.000 ordrer. Vælg en kortere periode." }, { status: 400 });
  if (!orders.length) return NextResponse.json({ error: "Ingen bekræftede ordrer i perioden." }, { status: 404 });
  return new NextResponse(bookkeepingCsv(orders), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="VBK-bogfoering-${from}-${to}.csv"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
