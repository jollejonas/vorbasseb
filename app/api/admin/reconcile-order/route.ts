import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fulfillOrder } from "@/lib/fulfillOrder";

export async function POST(req: NextRequest) {
  const user = await auth();
  // @ts-expect-error custom field
  if (user?.user?.role !== "ADMIN") return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.reference !== "string" || !/^(pi_|cs_)[A-Za-z0-9_]+$/.test(body.reference)) {
    return NextResponse.json({ error: "Indtast et Stripe-id, der starter med pi_ eller cs_." }, { status: 400 });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const checkout = body.reference.startsWith("cs_")
      ? await stripe.checkout.sessions.retrieve(body.reference)
      : (await stripe.checkout.sessions.list({ payment_intent: body.reference, limit: 1 })).data[0];
    if (!checkout || checkout.mode !== "payment" || checkout.status !== "complete" ||
        !["paid", "no_payment_required"].includes(checkout.payment_status)) {
      return NextResponse.json({ error: "Stripe har ikke bekræftet en gennemført bestilling for dette id." }, { status: 409 });
    }
    const order = checkout.metadata?.orderId ? await prisma.order.findUnique({ where: { id: checkout.metadata.orderId } }) : null;
    if (!order || (order.stripeSessionId && order.stripeSessionId !== checkout.id)) {
      return NextResponse.json({ error: "Betalingen kunne ikke knyttes sikkert til en eksisterende bestilling. Intet er ændret." }, { status: 409 });
    }
    if (order.status === "CANCELLED" || order.status === "REFUNDED") {
      return NextResponse.json({ error: "Ordren er annulleret eller refunderet og genåbnes ikke automatisk." }, { status: 409 });
    }
    // A recovery must never fulfill a payment that has since been refunded.
    const paymentId = typeof checkout.payment_intent === "string" ? checkout.payment_intent : checkout.payment_intent?.id;
    if (paymentId) {
      const payment = await stripe.paymentIntents.retrieve(paymentId, { expand: ["latest_charge"] });
      const charge = payment.latest_charge;
      if (payment.status !== "succeeded" || !charge || typeof charge === "string" || charge.amount_refunded > 0 || charge.disputed) {
        return NextResponse.json({ error: "Betalingen kræver manuel kontrol af refundering eller indsigelse. Intet er ændret." }, { status: 409 });
      }
    }
    await fulfillOrder(checkout);
    const confirmed = await prisma.order.findUnique({ where: { id: order.id } });
    if (!confirmed?.orderNumber || confirmed.status === "PENDING") throw new Error("Order not confirmed");
    return NextResponse.json({ orderId: confirmed.id, orderNumber: confirmed.orderNumber });
  } catch (error) {
    console.error("[reconcile-order]", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Ordren kunne ikke færdigbehandles. Fejlen er registreret i serverloggen. Kunden skal ikke betale igen." }, { status: 503 });
  }
}
