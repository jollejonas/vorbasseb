import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { manualOrderEmailHtml, sendOrderEmail } from "@/lib/order-email";

const inputSchema = z.object({
  subject: z.string().trim().min(1).max(200).refine(s => !/[\r\n]/.test(s)),
  message: z.string().trim().min(1).max(10000),
  requestKey: z.string().uuid(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Ingen adgang" }, { status: 403 });
  const input = inputSchema.safeParse(await req.json().catch(() => null));
  if (!input.success) return NextResponse.json({ error: "Udfyld et emne og en besked (maks. 10.000 tegn)." }, { status: 400 });
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: { user: { select: { email: true } } } });
  if (!order || order.orderNumber === null || order.status === "PENDING") return NextResponse.json({ error: "Ordren findes ikke." }, { status: 404 });
  const to = order.guestEmail || order.user?.email;
  if (!to || !z.string().email().safeParse(to).success) return NextResponse.json({ error: "Ordren mangler en gyldig e-mailadresse." }, { status: 400 });
  const from = process.env.RESEND_FROM_EMAIL;
  if (!from) return NextResponse.json({ error: "Afsenderadressen er ikke konfigureret." }, { status: 503 });
  try {
    const log = await sendOrderEmail({
      orderId: id, requestKey: input.data.requestKey, kind: "UPDATE", automatic: false,
      triggeredBy: [session?.user?.name, session?.user?.email].filter(Boolean).join(" · ") || "Administrator",
      from, to, subject: input.data.subject, html: manualOrderEmailHtml(input.data.message, order.orderNumber),
    });
    return NextResponse.json({ status: log.status }, { status: log.status === "ACCEPTED" ? 200 : 409 });
  } catch {
    return NextResponse.json({ error: "Afsendelsen kunne ikke bekræftes. Opdatér historikken, før du prøver igen." }, { status: 503 });
  }
}
