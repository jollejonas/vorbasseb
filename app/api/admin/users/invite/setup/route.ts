import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({
  token: z.string().min(1),
  name: z.string().min(2),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ugyldige data" }, { status: 400 });
  }

  const { token, name, password } = parsed.data;

  const invite = await prisma.adminInviteToken.findUnique({ where: { token } });
  if (!invite || invite.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invitationslinket er udløbet eller ugyldigt" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: invite.email } });
  if (existing) {
    return NextResponse.json(
      { error: "En bruger med denne e-mail eksisterer allerede" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        email: invite.email,
        name,
        passwordHash,
        role: "ADMIN",
      },
    }),
    prisma.adminInviteToken.delete({ where: { token } }),
  ]);

  return NextResponse.json({ ok: true });
}
