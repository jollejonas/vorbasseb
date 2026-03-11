import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation, sendLowStockAlert } from "@/lib/email";

/**
 * Fulfills a Stripe checkout.session.completed event.
 * Idempotent — safe to call from both the webhook and the success page.
 * Returns true if the order was fulfilled, false if it was already done.
 */
export async function fulfillOrder(session: Stripe.Checkout.Session): Promise<boolean> {
  if (session.mode !== "payment") return false;

  const { orderId, userId, grantIds, vatRate: vatRateMeta } = session.metadata ?? {};
  if (!orderId) return false;

  const vatRate = Number(vatRateMeta ?? 25);

  // Find the PENDING order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: { sku: { include: { product: { select: { name: true } } } } },
      },
    },
  });

  // Idempotency: skip if already fulfilled or not found
  if (!order || order.status !== "PENDING") return false;

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

      // Fulfill the order
      const paymentIntentId = typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent as { id?: string } | null)?.id ?? null;

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: "PAID",
          stripeSessionId: session.id,
          stripePaymentId: paymentIntentId,
          total: session.amount_total ?? order.total,
          customerName,
          phone,
          guestEmail: session.customer_details?.email ?? null,
          ...(addressId ? { addressId } : {}),
        },
      });

      // Mark any applied grants as USED
      const parsedGrantIds: string[] = grantIds ? JSON.parse(grantIds) : [];
      if (parsedGrantIds.length > 0) {
        await tx.trainerGrant.updateMany({
          where: { id: { in: parsedGrantIds }, status: "PENDING" },
          data: { status: "USED", orderId },
        });
      }

      // Decrement stock for each order item
      for (const item of order.items) {
        if (item.skuId) {
          await tx.sKU.update({ where: { id: item.skuId }, data: { stock: { decrement: item.quantity } } });
        } else {
          // Pakketilbud — sub-item skuIds stored in optionSelections
          const opts = item.optionSelections as { isPakketilbud?: boolean; items?: { skuId: string }[] } | null;
          for (const comp of (opts?.items ?? [])) {
            await tx.sKU.update({ where: { id: comp.skuId }, data: { stock: { decrement: item.quantity } } });
          }
        }
      }
    },
  );

  // Send low-stock alerts outside the transaction (external service)
  for (const item of order.items) {
    const skuIdsToCheck = item.skuId
      ? [item.skuId]
      : ((item.optionSelections as { items?: { skuId: string }[] } | null)?.items ?? []).map((c) => c.skuId);
    for (const skuId of skuIdsToCheck) {
      const sku = await prisma.sKU.findUnique({
        where: { id: skuId },
        include: { product: { select: { name: true } } },
      });
      if (sku && sku.stock <= 2) {
        await sendLowStockAlert(sku.product.name, sku.size, sku.stock).catch(() => {});
      }
    }
  }

  const email = session.customer_details?.email;
  if (email) {
    await sendOrderConfirmation({
      to: email,
      customerName,
      orderTotal: session.amount_total ?? order.total,
      items: order.items.map((item) => {
        const priceInclVat = Math.round(item.priceAtPurchase * (1 + vatRate / 100));
        if (!item.skuId) {
          const opts = item.optionSelections as { pakketilbudName?: string; items?: { label?: string; productName?: string; size?: string; colorName?: string }[] } | null;
          const compNames = (opts?.items ?? [])
            .map((c) => `${c.label || c.productName || ""} (${c.size ?? ""}${c.colorName ? ` / ${c.colorName}` : ""})`)
            .join(", ");
          return {
            productName: opts?.pakketilbudName ?? "Pakketilbud",
            size: compNames,
            quantity: item.quantity,
            price: priceInclVat,
          };
        }
        return {
          productName: item.sku?.product.name ?? "",
          size: item.sku?.size ?? "",
          colorName: item.colorName ?? undefined,
          quantity: item.quantity,
          price: priceInclVat,
          customName: item.customName ?? undefined,
          customNumber: item.customNumber ?? undefined,
        };
      }),
    }).catch(() => {}); // don't fail the fulfillment if email fails
  }

  return true;
}
