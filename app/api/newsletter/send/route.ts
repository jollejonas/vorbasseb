import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL;
const BATCH_SIZE = 50;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://vorbassebk.dk";

/** Strip HTML tags for a basic plain-text fallback */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!FROM) {
    return NextResponse.json(
      { error: "RESEND_FROM_EMAIL er ikke konfigureret. Tilføj en verificeret afsender-e-mail i Vercel miljøvariable." },
      { status: 503 }
    );
  }

  const { subject, html } = await req.json();
  if (!subject || !html) {
    return NextResponse.json({ error: "subject og html er påkrævet" }, { status: 400 });
  }

  const subscribers = await prisma.user.findMany({
    where: { newsletterConsent: true },
    select: { email: true, name: true },
  });

  if (subscribers.length === 0) {
    return NextResponse.json({ sent: 0 });
  }

  const bodyText = htmlToPlainText(html);

  function buildEmail(email: string) {
    const unsubscribeUrl = `${APP_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
    const emailHtml = `
    <!DOCTYPE html>
    <html lang="da">
    <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
    <body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
      ${html}
      <hr style="margin-top:32px;border:none;border-top:1px solid #eee" />
      <p style="font-size:12px;color:#888;margin-top:16px">
        Du modtager denne e-mail fordi du har tilmeldt dig nyhedsbrevet fra VBK Shoppen.
        Du kan til enhver tid <a href="${unsubscribeUrl}" style="color:#888">afmelde dig her</a>.
      </p>
      <p style="font-size:12px;color:#888">Mvh. Vorbasse Boldklub</p>
    </body>
    </html>
  `;
    const emailText =
      bodyText +
      `\n\n---\nDu modtager denne e-mail fordi du har tilmeldt dig nyhedsbrevet fra VBK Shoppen.\nAfmeld: ${unsubscribeUrl}\n\nMvh. Vorbasse Boldklub`;

    return {
      from: `Vorbasse Boldklub <${FROM}>`,
      to: email,
      subject,
      html: emailHtml,
      text: emailText,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    };
  }

  // Send in batches of 50
  let sent = 0;
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    try {
      await resend.batch.send(batch.map((s) => buildEmail(s.email)));
      sent += batch.length;
    } catch (err) {
      console.error("Resend batch failed:", err);
      return NextResponse.json({ error: "E-mail afsendelse fejlede. Tjek Resend-konfigurationen." }, { status: 500 });
    }
  }

  return NextResponse.json({ sent });
}
