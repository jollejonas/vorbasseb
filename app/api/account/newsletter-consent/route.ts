import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { newsletterConsent } = await req.json();
  if (typeof newsletterConsent !== "boolean") {
    return NextResponse.json({ error: "Ugyldig input" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      newsletterConsent,
      newsletterConsentAt: newsletterConsent ? new Date() : null,
    },
    select: { id: true, newsletterConsent: true },
  });

  return NextResponse.json(user);
}
