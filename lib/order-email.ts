import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

type OrderEmailInput = {
  orderId: string;
  requestKey?: string;
  kind: "CONFIRMATION" | "SHIPPING" | "UPDATE";
  automatic: boolean;
  triggeredBy?: string;
  from: string;
  to: string;
  subject: string;
  html: string;
};

/** Persist the exact payload before contacting the provider. Never claim delivery. */
export async function sendOrderEmail(input: OrderEmailInput) {
  let log;
  try {
    log = await prisma.orderEmail.create({ data: input });
  } catch (error) {
    // Preserve existing automatic notifications during rollout if the new table is absent.
    // Manual messages still require a durable log; other database errors never bypass logging.
    const dbError = error as { code?: string; meta?: { table?: string; modelName?: string } };
    if (input.automatic && dbError.code === "P2021" &&
        (dbError.meta?.modelName === "OrderEmail" || dbError.meta?.table?.endsWith("OrderEmail"))) {
      console.error("OrderEmail table missing: automatic notification sent without history");
      const result = await resend.emails.send({
        from: input.from, to: input.to, subject: input.subject, html: input.html,
      }, { idempotencyKey: `order-email-rollout/${input.orderId}/${input.kind}` });
      if (result.error || !result.data?.id) throw new Error("Automatic order email was not accepted");
      return { status: "ACCEPTED", providerId: result.data.id };
    }
    // A double click or network retry must not send a second manual message.
    if (input.requestKey && (error as { code?: string }).code === "P2002") {
      const existing = await prisma.orderEmail.findUnique({ where: { requestKey: input.requestKey } });
      if (existing && existing.orderId === input.orderId) return existing;
    }
    throw error;
  }

  let result;
  try {
    result = await resend.emails.send({
      from: log.from, to: log.to, subject: log.subject, html: log.html,
    }, { idempotencyKey: `order-email/${log.id}` });
  } catch {
    // A timeout can happen after acceptance. Do not label it as a definite failure.
    return prisma.orderEmail.update({ where: { id: log.id }, data: {
      status: "UNKNOWN", error: "Mailtjenesten svarede ikke entydigt. Kontrollér afsendelsen, før du sender igen.",
    } });
  }
  if (result.error) {
    return prisma.orderEmail.update({ where: { id: log.id }, data: {
      status: "FAILED", error: "Mailtjenesten afviste afsendelsen.",
    } });
  }
  return prisma.orderEmail.update({ where: { id: log.id }, data: {
    status: result.data?.id ? "ACCEPTED" : "UNKNOWN",
    providerId: result.data?.id ?? null,
    sentAt: result.data?.id ? new Date() : null,
  } });
}

export function manualOrderEmailHtml(message: string, orderNumber: number) {
  const escaped = message.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  return `<!doctype html><html lang="da"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;margin:0;background:#f1f5f9"><div style="max-width:600px;margin:24px auto;background:white;padding:24px;border-top:4px solid #f4cd35"><h2 style="color:#142e57">Vorbasse Boldklub</h2><p>Opdatering om ordre #${orderNumber}</p><div>${escaped.replace(/\r?\n/g, "<br />")}</div><hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0"><p>Vorbasse Boldklub · Shop</p></div></body></html>`;
}
