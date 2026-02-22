import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation, sendShippingNotification } from "@/lib/email";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;

  const { userId, cartJson, shippingFee, isMember, deliveryMethod } = session.metadata ?? {};
  if (!cartJson) return;

  type CartMeta = {
    skuId: string;
    quantity: number;
    price: number;
    customName: string;
    customNumber: string;
    customizationFee: number;
  };
  const items: CartMeta[] = JSON.parse(cartJson);

  const subtotal = items.reduce(
    (s, i) => s + (i.price + i.customizationFee) * i.quantity,
    0,
  );
  const discountApplied =
    isMember === "true" ? Math.round(subtotal * 0.1) : 0;

  await prisma.$transaction(
    async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      await tx.order.create({
        data: {
          userId: userId || null,
          guestEmail: session.customer_details?.email ?? null,
          status: "PAID",
          stripeSessionId: session.id,
          stripePaymentId: session.payment_intent as string,
          total:
            session.amount_total ??
            subtotal - discountApplied + Number(shippingFee ?? 0),
          discountApplied,
          shippingFee: Number(shippingFee ?? 0),
          deliveryMethod: deliveryMethod === "PICKUP" ? "PICKUP" : "SHIPPING",
          items: {
            create: items.map((i) => ({
              skuId: i.skuId,
              quantity: i.quantity,
              priceAtPurchase: i.price + i.customizationFee,
              customName: i.customName || null,
              customNumber: i.customNumber || null,
            })),
          },
        },
      });

      // Decrement stock for each item
      for (const item of items) {
        await tx.sKU.update({
          where: { id: item.skuId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    },
  );

  const email = session.customer_details?.email;
  if (email) {
    await sendOrderConfirmation({
      to: email,
      orderTotal: session.amount_total ?? 0,
      items,
    });
  }
}

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  if (!userId) return;

  const status =
    sub.status === "active"
      ? "ACTIVE"
      : sub.status === "past_due"
        ? "PAST_DUE"
        : "CANCELED";

  const plan =
    (sub.items.data[0]?.price.id ?? "") === process.env.STRIPE_PRICE_YEARLY
      ? "YEARLY"
      : "MONTHLY";

  // current_period_end lives on the SubscriptionItem in Stripe SDK v17+
  const periodEndTs = sub.items.data[0]?.current_period_end;
  const currentPeriodEnd = periodEndTs
    ? new Date(periodEndTs * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // fallback 30 days

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeSubscriptionId: sub.id,
      stripeCustomerId: sub.customer as string,
      status,
      plan,
      currentPeriodEnd,
    },
    update: {
      stripeSubscriptionId: sub.id,
      status,
      plan,
      currentPeriodEnd,
    },
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: sub.id },
    data: { status: "CANCELED" },
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // In Stripe v17+ subscription is accessed via invoice.parent.subscription_details
  const subId =
    invoice.parent?.type === "subscription_details" &&
    invoice.parent.subscription_details
      ? typeof invoice.parent.subscription_details.subscription === "string"
        ? invoice.parent.subscription_details.subscription
        : invoice.parent.subscription_details.subscription?.id
      : null;

  if (!subId) return;

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subId },
    data: { status: "PAST_DUE" },
  });
}

// Re-export sendShippingNotification to prevent unused import warning
export { sendShippingNotification };
