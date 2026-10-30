import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

const resend = new Resend(process.env.RESEND_API_KEY);

// RESEND_FROM_EMAIL must be set to an address on a Resend-verified domain.
// Without a verified domain, all sends will fail silently.
const FROM = process.env.RESEND_FROM_EMAIL ?? "";

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDKK(ore: number) {
  return new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK" }).format(ore / 100);
}

// ─── Template helpers ────────────────────────────────────────────────────────

async function loadTemplate(key: string, defaultValue: string): Promise<string> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row?.value || defaultValue;
  } catch {
    return defaultValue;
  }
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(`{{${k}}}`, v), template);
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="da">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a1a; }
    h2 { color: #1a1a1a; } h3 { color: #444; margin-top: 24px; }
    ul { padding-left: 20px; } li { margin-bottom: 4px; }
    hr { border: none; border-top: 1px solid #eee; margin: 24px 0; }
  </style>
</head>
<body>${body}</body>
</html>`;
}

// ─── Default templates ────────────────────────────────────────────────────────

const DEFAULT_ORDER_SUBJECT = "Ordrebekræftelse – Vorbasse Boldklub";
const DEFAULT_ORDER_BODY = `<h2>Tak for din ordre! 💛💙</h2>
<p>Kære {{customerName}},</p>
<p>Vi har modtaget din bestilling. Du får besked, når den er klar til afhentning eller afsendt.</p>
<h3>Ordresammenfatning</h3>
{{items}}
<p><strong>Total betalt: {{total}}</strong></p>
<hr />
<p>Mvh. Vorbasse Boldklub</p>`;

const DEFAULT_SHIPPING_SUBJECT = "Din ordre er afsendt – Vorbasse Boldklub";
const DEFAULT_SHIPPING_BODY = `<h2>Din ordre er på vej! 🚚</h2>
<p>Kære {{customerName}},</p>
<p>Vi har afsendt din ordre ({{orderId}}).</p>
{{trackingNumber}}
<h3>Bestilte varer</h3>
{{items}}
<p>Forventet leveringstid: 2–5 hverdage.</p>
<hr />
<p>Mvh. Vorbasse Boldklub</p>`;

// ─── Email functions ──────────────────────────────────────────────────────────

type OrderItem = {
  photos?: { url?: string; name: string }[];
  imageUrl?: string;
  productName: string;
  size?: string;
  colorName?: string;
  quantity: number;
  price: number;
  customName?: string;
  customNumber?: string;
  customizationFee?: number;
};

export async function sendOrderConfirmation({
  to,
  customerName,
  orderTotal,
  orderNumber,
  deliveryMethod,
  groupOrderHoldUntil,
  items,
}: {
  to: string;
  customerName?: string | null;
  orderTotal: number;
  orderNumber?: number;
  deliveryMethod?: string;
  groupOrderHoldUntil?: Date | null;
  items: OrderItem[];
}) {
  const subject = await loadTemplate("email_order_subject", DEFAULT_ORDER_SUBJECT);
  const bodyTemplate = await loadTemplate("email_order_body", DEFAULT_ORDER_BODY);

  const itemsHtml = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:20px 0">${items.map((i) => {
    const details = [i.size, i.colorName, i.customName ? `Tryk: ${i.customName}` : null, i.customNumber ? `#${i.customNumber}` : null].filter(Boolean).join(" · ");
    const photos = (i.photos ?? [{ url: i.imageUrl, name: i.productName }]).map(photo => {
    let imageUrl = "";
    try {
      const url = new URL(photo.url ?? "", "https://shop.vorbasseboldklub.dk");
      if (photo.url && ["https:", "http:"].includes(url.protocol)) imageUrl = url.href;
    } catch { /* Missing or invalid photo: preserve the product details. */ }
    return imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(photo.name)}" width="72" style="display:block;width:72px;height:auto;margin-bottom:6px;border:1px solid #e5e7eb;border-radius:6px" />` : '<span style="font-size:11px;color:#64748b">Intet billede</span>';
    }).join("");
    return `<tr>
      <td width="80" style="padding:16px 12px 16px 0;border-bottom:1px solid #e5e7eb;vertical-align:top">${photos}</td>
      <td style="padding:16px 8px 16px 0;border-bottom:1px solid #e5e7eb;vertical-align:top"><strong>${escapeHtml(i.productName)}</strong><br /><span style="font-size:13px;color:#64748b;line-height:1.6">${escapeHtml(details)}<br />Antal: ${i.quantity} · ${formatDKK(i.price)} pr. stk.</span></td>
      <td align="right" style="padding:16px 0;border-bottom:1px solid #e5e7eb;vertical-align:top;font-weight:bold;white-space:nowrap">${formatDKK((i.price + (i.customizationFee ?? 0)) * i.quantity)}</td>
    </tr>`;
  }).join("")}</table>`;
  const delivery = deliveryMethod === "PICKUP" ? "Afhentning ved klubben. Du får besked, når ordren er klar." : "Du får besked, når ordren er afsendt.";
  const hold = groupOrderHoldUntil ? `<p>Samlebestilling: Behandles efter ${new Intl.DateTimeFormat("da-DK", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Copenhagen" }).format(groupOrderHoldUntil)}.</p>` : "";

  const vars = { customerName: escapeHtml(customerName ?? ""), items: itemsHtml, total: formatDKK(orderTotal) };
  await resend.emails.send({
    from: FROM,
    to,
    subject: renderTemplate(subject, vars),
    html: `<!DOCTYPE html><html lang="da"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#172033;line-height:1.6">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #e2e8f0">
<tr><td style="padding:24px;background:#142e57;color:#ffffff;border-bottom:4px solid #f4cd35"><strong style="font-size:22px">Vorbasse Boldklub</strong><br /><span style="font-size:13px">SHOP · ORDREBEKRÆFTELSE${orderNumber ? ` · #${orderNumber}` : ""}</span></td></tr>
<tr><td style="padding:24px">${renderTemplate(bodyTemplate, vars)}<div style="padding:16px;background:#f8fafc;border-top:1px solid #e2e8f0"><strong>Levering</strong><p>${delivery}</p>${hold}</div><p style="font-size:12px;color:#64748b">Alle beløb er inkl. moms.</p></td></tr>
<tr><td style="padding:20px 24px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b">Tak fordi du støtter klubben.<br /><a href="https://shop.vorbasseboldklub.dk" style="color:#142e57">shop.vorbasseboldklub.dk</a></td></tr>
</table></td></tr></table></body></html>`,
  });
}

export async function sendShippingNotification({
  to,
  customerName,
  orderId,
  trackingNumber,
  items,
}: {
  to: string;
  customerName?: string | null;
  orderId: string;
  trackingNumber?: string | null;
  items?: { productName: string; size?: string; quantity: number }[];
}) {
  const subject = await loadTemplate("email_shipping_subject", DEFAULT_SHIPPING_SUBJECT);
  const bodyTemplate = await loadTemplate("email_shipping_body", DEFAULT_SHIPPING_BODY);

  const trackingHtml = trackingNumber
    ? `<p>Trackingnummer: <strong>${escapeHtml(trackingNumber)}</strong></p>`
    : "";

  const itemsHtml = items && items.length > 0
    ? `<ul>${items.map((i) => `<li>${i.quantity}× <strong>${escapeHtml(i.productName)}</strong>${i.size ? ` (${escapeHtml(i.size)})` : ""}</li>`).join("")}</ul>`
    : "";

  const vars = {
    customerName: escapeHtml(customerName ?? ""),
    orderId: escapeHtml(orderId),
    trackingNumber: trackingHtml,
    items: itemsHtml,
  };
  await resend.emails.send({
    from: FROM,
    to,
    subject: renderTemplate(subject, vars),
    html: wrapHtml(renderTemplate(bodyTemplate, vars)),
  });
}

export async function sendFanklubWelcome({ to }: { to: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Velkommen som fanklubsmedlem! 🌟",
    html: wrapHtml(`
      <h2>Velkommen til Vorbasse Boldklub Fanklub!</h2>
      <p>Du har nu adgang til følgende fordele:</p>
      <ul>
        <li>✅ 10% rabat på alle køb i butikken</li>
        <li>✅ Adgang til eksklusivt fanklubs-merchandise</li>
      </ul>
      <p>Rabatten påføres automatisk ved næste køb.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `),
  });
}

export async function sendPaymentFailed({ to }: { to: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Betalingsfejl på dit fanklubsabonnement",
    html: wrapHtml(`
      <h2>Betaling mislykkedes</h2>
      <p>Vi kunne desværre ikke trække betaling for dit fanklubsabonnement.</p>
      <p>Opdater venligst din betalingsmetode for at bevare dine medlemsfordele.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `),
  });
}

export async function sendAdminInvite({ to, inviteUrl }: { to: string; inviteUrl: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Du er inviteret som admin – Vorbasse Boldklub",
    html: wrapHtml(`
      <h2>Du er inviteret som admin</h2>
      <p>Du er blevet inviteret til at få administratoradgang til Vorbasse Boldklubs hjemmeside.</p>
      <p>Klik på knappen nedenfor for at oprette din konto. Linket er gyldigt i 48 timer.</p>
      <p style="margin: 32px 0;">
        <a href="${escapeHtml(inviteUrl)}" style="background:#1a56db;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Opret admin-konto
        </a>
      </p>
      <p style="color:#888;font-size:0.85em;">Hvis du ikke forventede denne invitation kan du se bort fra denne e-mail.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `),
  });
}

export async function sendLowStockAlert(productName: string, size: string, stock: number) {
  const adminTo = process.env.ADMIN_EMAIL ?? FROM;
  await resend.emails.send({
    from: FROM,
    to: adminTo,
    subject: `Lav lagerstatus: ${productName} (${size})`,
    html: wrapHtml(`
      <h2>Lav lagerstatus</h2>
      <p>Produktet <strong>${escapeHtml(productName)}</strong>, størrelse <strong>${escapeHtml(size)}</strong>, har kun <strong>${stock}</strong> ${stock === 1 ? "enhed" : "enheder"} tilbage.</p>
      <p>Genopfyld venligst lageret snarest.</p>
      <hr />
      <p>VBK Shoppen – automatisk besked</p>
    `),
  });
}
