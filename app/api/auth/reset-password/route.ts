import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPassword } from "@/lib/password-reset";

const schema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  password: z.string().min(8).refine((value) => Buffer.byteLength(value, "utf8") <= 72),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Kontrollér linket og brug et kodeord på mindst 8 tegn og højst 72 bytes." }, { status: 400 });
  try {
    if (!await resetPassword(parsed.data.token, parsed.data.password)) {
      return NextResponse.json({ error: "Linket er ugyldigt eller udløbet. Bed om et nyt link." }, { status: 400 });
    }
    return NextResponse.json({ message: "Dit kodeord er ændret. Du kan nu logge ind med dit nye kodeord." });
  } catch {
    console.error("Password reset failed.");
    return NextResponse.json({ error: "Kodeordet kunne ikke ændres. Prøv igen om lidt." }, { status: 500 });
  }
}
