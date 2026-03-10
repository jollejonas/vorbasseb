import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * One-click unsubscribe endpoint.
 * Called by email clients that support RFC 8058 List-Unsubscribe-Post.
 * The email address is passed as a query parameter: /api/newsletter/unsubscribe?email=...
 *
 * GET  — shows a simple confirmation page (for manual unsubscribe links)
 * POST — immediately opts out (for one-click from email clients)
 */

export async function POST(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return new NextResponse("Missing email", { status: 400 });
  }

  await prisma.user.updateMany({
    where: { email },
    data: { newsletterConsent: false },
  });

  return new NextResponse("Unsubscribed", { status: 200 });
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  if (!email) {
    return new NextResponse("Missing email", { status: 400 });
  }

  await prisma.user.updateMany({
    where: { email },
    data: { newsletterConsent: false },
  });

  return new NextResponse(
    `<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><title>Afmeldt nyhedsbrev</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#333">
  <h1 style="font-size:1.5rem">Du er afmeldt</h1>
  <p style="color:#666">${email} modtager ikke længere nyhedsbreve fra Vorbasse Boldklub.</p>
  <p><a href="/" style="color:#888;font-size:14px">← Tilbage til forsiden</a></p>
</body>
</html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
}
