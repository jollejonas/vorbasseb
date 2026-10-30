import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  const { id } = await params;
  const cursor = req.nextUrl.searchParams.get("cursor");
  if (!/^promo_[A-Za-z0-9]+$/.test(id) || (cursor && !/^cs_[A-Za-z0-9_]+$/.test(cursor))) {
    return NextResponse.json({ error: "Ugyldigt id" }, { status: 400 });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const promo = await stripe.promotionCodes.retrieve(id);
    // Bound each request and expose pagination: never silently stop after 100 sessions.
    const page = await stripe.checkout.sessions.list({
      status: "complete", limit: 100,
      ...(cursor ? { starting_after: cursor } : {}),
    });
    const matches = page.data.filter(s => s.mode === "payment" && s.discounts?.some(d =>
      (typeof d.promotion_code === "string" ? d.promotion_code : d.promotion_code?.id) === id));
    const ids = matches.flatMap(s => s.metadata?.orderId ? [s.metadata.orderId] : []);
    const orders = ids.length ? await prisma.order.findMany({ where: { id: { in: ids } }, include: {
      items: { include: { sku: { include: { product: { select: { name: true } } } } } },
    } }) : [];
    const byId = new Map(orders.map(o => [o.id, o]));
    return NextResponse.json({
      code: promo.code, redeemed: promo.times_redeemed,
      nextCursor: page.has_more ? page.data.at(-1)?.id ?? null : null,
      scanned: page.data.length,
      orders: matches.map(s => {
        const candidate = byId.get(s.metadata?.orderId ?? "");
        const order = candidate && (!candidate.stripeSessionId || candidate.stripeSessionId === s.id) ? candidate : undefined;
        const confirmed = !!order && order.status !== "PENDING" && order.orderNumber != null;
        return {
          sessionId: s.id, created: s.created, name: s.customer_details?.name || order?.customerName || "Navn ikke oplyst",
          email: s.customer_details?.email || order?.guestEmail || null,
          total: s.amount_total, currency: s.currency, discount: s.total_details?.amount_discount ?? 0,
          paymentStatus: s.payment_status, orderId: order?.id ?? null, orderNumber: order?.orderNumber ?? null,
          status: confirmed ? "CONFIRMED" : order?.status === "PENDING" ? "NEEDS_PROCESSING" : "MISSING",
          orderStatus: order?.status ?? null,
          items: order?.items.map(i => ({
            name: i.sku?.product.name || "Pakketilbud / produkt ikke længere tilgængeligt",
            size: i.sku?.size ?? null, quantity: i.quantity,
          })) ?? [],
        };
      }),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Bestillingerne kunne ikke hentes fra Stripe og shoppen. Prøv igen." }, { status: 503 });
  }
}
