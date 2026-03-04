import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation, sendShippingNotification, sendLowStockAlert } from "@/lib/email";

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

  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[stripe webhook] handler error:", message);
    // Return 200 so Stripe stops retrying; check Vercel logs for the actual error
    return NextResponse.json({ received: true, handlerError: message });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;

  const { userId, cartJson, shippingFee, isMember, deliveryMethod, grantIds, totalDiscountApplied } = session.metadata ?? {};
  if (!cartJson) return;

  // Idempotency: skip if order already exists for this session
  const existing = await prisma.order.findUnique({
    where: { stripeSessionId: session.id },
  });
  if (existing) return;

  type CartMeta = {
    skuId: string;
    quantity: number;
    price: number;
    customName: string;
    customNumber: string;
    customizationFee: number;
    colorName: string;
  };
  const items: CartMeta[] = JSON.parse(cartJson);

  // Use the combined discount value stored in metadata (grants + member discount)
  const discountApplied = Number(totalDiscountApplied ?? 0);

  const customerName = session.customer_details?.name ?? null;
  const phone = session.customer_details?.phone ?? null;
  const shippingInfo = session.collected_information?.shipping_details;

  await prisma.$transaction(
    async (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
      // Create address record from shipping details (if available)
      let addressId: string | null = null;
      if (shippingInfo?.address && shippingInfo.name) {
        const address = await tx.address.create({
          data: {
            userId: userId || null,
            name: shippingInfo.name,
            line1: shippingInfo.address.line1 ?? "",
            line2: shippingInfo.address.line2 ?? null,
            city: shippingInfo.address.city ?? "",
            postcode: shippingInfo.address.postal_code ?? "",
            country: shippingInfo.address.country ?? "DK",
          },
        });
        addressId = address.id;
      }

      const createdOrder = await tx.order.create({
        data: {
          userId: userId || null,
          guestEmail: session.customer_details?.email ?? null,
          customerName,
          phone,
          status: "PAID",
          stripeSessionId: session.id,
          stripePaymentId: session.payment_intent as string,
          total: session.amount_total ?? 0,
          discountApplied,
          shippingFee: Number(shippingFee ?? 0),
          deliveryMethod: deliveryMethod === "PICKUP" ? "PICKUP" : "SHIPPING",
          addressId,
          items: {
            create: items.map((i) => ({
              skuId: i.skuId,
              quantity: i.quantity,
              priceAtPurchase: i.price + i.customizationFee,
              customName: i.customName || null,
              customNumber: i.customNumber || null,
              colorName: i.colorName || null,
            })),
          },
        },
        select: { id: true },
      });

      // Mark any applied grants as USED
      const parsedGrantIds: string[] = grantIds ? JSON.parse(grantIds) : [];
      if (parsedGrantIds.length > 0) {
        await tx.trainerGrant.updateMany({
          where: { id: { in: parsedGrantIds }, status: "PENDING" },
          data: { status: "USED", orderId: createdOrder.id },
        });
      }

      // Decrement stock for each item
      for (const item of items) {
        await tx.sKU.update({
          where: { id: item.skuId },
          data: { stock: { decrement: item.quantity } },
        });
      }
    },
  );

  // Send low-stock alerts outside the transaction (external service)
  for (const item of items) {
    const sku = await prisma.sKU.findUnique({
      where: { id: item.skuId },
      include: { product: { select: { name: true } } },
    });
    if (sku && sku.stock <= 2) {
      await sendLowStockAlert(sku.product.name, sku.size, sku.stock).catch(
        () => {},
      );
    }
  }

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
