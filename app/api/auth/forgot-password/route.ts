import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset, RESET_MESSAGE } from "@/lib/password-reset";

const schema = z.object({ email: z.string().trim().email().max(254) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Indtast en gyldig e-mailadresse." }, { status: 400 });
  try {
    await requestPasswordReset(parsed.data.email);
  } catch {
    // Never disclose account existence, tokens, or email addresses in responses/logs.
    console.error("Password reset request failed; check database and email configuration.");
  }
  return NextResponse.json({ message: RESET_MESSAGE });
}
