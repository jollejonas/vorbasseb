import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const templates = await prisma.optionGroupTemplate.findMany({
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    include: {
      values: {
        include: { globalColor: true },
        orderBy: { position: "asc" },
      },
    },
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const { name, type, tags, required, fee, inputType, values } = body as {
    name: string;
    type: string;
    tags: string[];
    required: boolean;
    fee?: number | null;
    inputType?: string | null;
    values: { label: string; position: number; globalColorId?: string | null; images?: string[] }[];
  };

  const template = await prisma.optionGroupTemplate.create({
    data: {
      name,
      type: type as never,
      tags: tags ?? [],
      required: required ?? false,
      fee: fee ?? null,
      inputType: inputType ?? null,
      values: {
        create: (values ?? []).map((v) => ({
          label: v.label,
          position: v.position,
          globalColorId: v.globalColorId ?? null,
          images: v.images ?? [],
        })),
      },
    },
    include: {
      values: { include: { globalColor: true }, orderBy: { position: "asc" } },
    },
  });

  return NextResponse.json(template, { status: 201 });
}
