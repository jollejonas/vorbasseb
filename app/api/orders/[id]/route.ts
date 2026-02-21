import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { sendShippingNotification } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
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
