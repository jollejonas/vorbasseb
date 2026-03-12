import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const first = typeof body.firstName === "string" ? body.firstName.trim() : undefined;
  const last  = typeof body.lastName  === "string" ? body.lastName.trim()  : undefined;

  // Derive name for NextAuth compatibility
  const derivedName = (first !== undefined || last !== undefined)
    ? [first ?? "", last ?? ""].filter(Boolean).join(" ") || null
    : undefined;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(derivedName !== undefined && { name: derivedName }),
      ...(first !== undefined && { firstName: first || null }),
      ...(last  !== undefined && { lastName:  last  || null }),
      ...(typeof body.phone        === "string" && { phone:        body.phone.trim()        || null }),
      ...(typeof body.birthDate    === "string"
        ? body.birthDate ? { birthDate: new Date(body.birthDate) } : { birthDate: null }
        : {}),
      ...(typeof body.addressLine1 === "string" && { addressLine1: body.addressLine1.trim() || null }),
      ...(typeof body.addressLine2 === "string" && { addressLine2: body.addressLine2.trim() || null }),
      ...(typeof body.postalCode   === "string" && { postalCode:   body.postalCode.trim()   || null }),
      ...(typeof body.city         === "string" && { city:         body.city.trim()         || null }),
      ...(typeof body.country      === "string" && { country:      body.country.trim()      || null }),
    },
    select: {
      id: true, name: true, firstName: true, lastName: true, email: true,
      phone: true, birthDate: true, addressLine1: true, addressLine2: true,
      postalCode: true, city: true, country: true,
    },
  });

  return NextResponse.json(user);
}
