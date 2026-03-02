import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const grant = await prisma.trainerGrant.findUnique({ where: { id } });

  if (!grant) {
    return NextResponse.json({ error: "Grant ikke fundet" }, { status: 404 });
  }

  if (grant.status !== "PENDING") {
    return NextResponse.json(
      { error: "Kun afventende tildelinger kan tilbagekaldes" },
      { status: 400 },
    );
  }

  await prisma.trainerGrant.update({
    where: { id },
    data: { status: "REVOKED" },
  });

  return NextResponse.json({ ok: true });
}
