import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const { name, type, tags, required, fee, inputType, values } = body as {
    name: string;
    type: string;
    tags: string[];
    required: boolean;
    fee?: number | null;
    inputType?: string | null;
    values: { id?: string; label: string; position: number; globalColorId?: string | null; images?: string[] }[];
  };

  // Collect incoming IDs to know which values to delete
  const incomingIds = (values ?? []).filter((v) => v.id).map((v) => v.id as string);

  const template = await prisma.$transaction(async (tx) => {
    // Delete removed values
    await tx.optionGroupTemplateValue.deleteMany({
      where: { templateId: id, id: { notIn: incomingIds } },
    });

    // Upsert each value
    for (const v of values ?? []) {
      if (v.id) {
        await tx.optionGroupTemplateValue.update({
          where: { id: v.id },
          data: {
            label: v.label,
            position: v.position,
            globalColorId: v.globalColorId ?? null,
            images: v.images ?? [],
          },
        });
      } else {
        await tx.optionGroupTemplateValue.create({
          data: {
            templateId: id,
            label: v.label,
            position: v.position,
            globalColorId: v.globalColorId ?? null,
            images: v.images ?? [],
          },
        });
      }
    }

    return tx.optionGroupTemplate.update({
      where: { id },
      data: {
        name,
        type: type as never,
        tags: tags ?? [],
        required: required ?? false,
        fee: fee ?? null,
        inputType: inputType ?? null,
      },
      include: {
        values: { include: { globalColor: true }, orderBy: { position: "asc" } },
      },
    });
  });

  return NextResponse.json(template);
}

export async function DELETE(_req: Request, { params }: Params) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  await prisma.optionGroupTemplate.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
