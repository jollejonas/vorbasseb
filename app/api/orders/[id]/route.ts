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

export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { status } = await req.json();

  const order = await prisma.order.update({
    where: { id },
    data: { status },
  });

  // Send shipping email when marked as SHIPPED
  if (status === "SHIPPED") {
    const email = order.guestEmail ?? null;
    if (!email && order.userId) {
      const user = await prisma.user.findUnique({ where: { id: order.userId } });
      if (user?.email) {
        await sendShippingNotification({ to: user.email, orderId: order.id });
      }
    } else if (email) {
      await sendShippingNotification({ to: email, orderId: order.id });
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

  // If status changed to SHIPPED and a tracking number is provided, send email
  if (body.status === "SHIPPED") {
    const email = order.guestEmail;
    const userId = order.userId;
    const resolvedEmail = email ?? (userId ? (await prisma.user.findUnique({ where: { id: userId }, select: { email: true } }))?.email : null);
    if (resolvedEmail) {
      await sendShippingNotification({ to: resolvedEmail, orderId: order.id });
    }
  }

  return NextResponse.json(order);
}
