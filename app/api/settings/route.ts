import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidateTag } from "next/cache";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const settings = await prisma.siteSetting.findMany();
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const settings = body.settings as { key: string; value: string }[];

  if (!Array.isArray(settings)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await prisma.$transaction(
    settings.map((s) =>
      prisma.siteSetting.upsert({
        where: { key: s.key },
        update: { value: s.value },
        create: { key: s.key, value: s.value },
      })
    )
  );

  // Invalidate cached VAT rate if it was updated
  if (settings.some((s) => s.key === "vat_rate")) {
    revalidateTag("vat_rate", {});
  }

  const updated = await prisma.siteSetting.findMany();
  return NextResponse.json(updated);
}
