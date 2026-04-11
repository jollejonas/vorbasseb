import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendAdminInvite } from "@/lib/email";
import { z } from "zod";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldig e-mailadresse" }, { status: 400 });
  }

  const { email } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "En bruger med denne e-mail eksisterer allerede" },
      { status: 409 },
    );
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  // Delete any existing invite for this email, then create a fresh one with a new token
  await prisma.adminInviteToken.deleteMany({ where: { email } });
  const invite = await prisma.adminInviteToken.create({ data: { email, expiresAt } });

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${baseUrl}/admin-opret-konto?token=${invite.token}`;

  await sendAdminInvite({ to: email, inviteUrl });

  return NextResponse.json({ ok: true });
}
