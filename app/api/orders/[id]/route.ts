import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendShippingNotification } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return null;
  return session;
}

async function resolveEmailAndItems(order: { guestEmail: string | null; userId: string | null; customerName: string | null }, id: string) {
  const email = order.guestEmail
    ?? (order.userId
      ? (await prisma.user.findUnique({ where: { id: order.userId }, select: { email: true } }))?.email ?? null
      : null);

  const fullOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { sku: { include: { product: true } } } } },
  });

  return {
    email,
    items: fullOrder?.items.map((i) => ({
      productName: i.sku?.product.name ?? "–",
      size: i.sku?.size,
      quantity: i.quantity,
    })),
  };
}

export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  const order = await prisma.order.update({ where: { id }, data: { status } });

  if (status === "SHIPPED") {
    const { email, items } = await resolveEmailAndItems(order, id);
    if (email) {
      await sendShippingNotification({
        to: email,
        customerName: order.customerName,
        orderId: order.id,
        items,
      });
    }
  }

  return NextResponse.json(order);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body: {
    status?: string;
    trackingNumber?: string | null;
    refunded?: boolean;
    cancelledAt?: string | null;
  } = await req.json();

  const data: Record<string, unknown> = {};
  if (body.status !== undefined) data.status = body.status;
  if (body.trackingNumber !== undefined) data.trackingNumber = body.trackingNumber;
  if (body.refunded !== undefined) data.refunded = body.refunded;
  if (body.cancelledAt !== undefined)
    data.cancelledAt = body.cancelledAt ? new Date(body.cancelledAt) : null;

  const order = await prisma.order.update({ where: { id }, data });

  if (body.status === "SHIPPED") {
    const { email, items } = await resolveEmailAndItems(order, id);
    if (email) {
      await sendShippingNotification({
        to: email,
        customerName: order.customerName,
        orderId: order.id,
        trackingNumber: body.trackingNumber ?? order.trackingNumber,
        items,
      });
    }
  }

  return NextResponse.json(order);
}
