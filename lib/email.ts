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
<p>Vi har modtaget din bestilling og sender den snarest.</p>
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
  items,
}: {
  to: string;
  customerName?: string | null;
  orderTotal: number;
  items: OrderItem[];
}) {
  const subject = await loadTemplate("email_order_subject", DEFAULT_ORDER_SUBJECT);
  const bodyTemplate = await loadTemplate("email_order_body", DEFAULT_ORDER_BODY);

  const itemsHtml = `<ul>${items.map((i) => {
    const details = [
      i.size,
      i.colorName,
      i.customName ? `Tryk: ${escapeHtml(i.customName)}` : null,
      i.customNumber ? `#${escapeHtml(i.customNumber)}` : null,
    ].filter(Boolean).join(", ");
    const fee = (i.customizationFee ?? 0) > 0 ? ` + ${formatDKK(i.customizationFee!)} tryk` : "";
    return `<li>${i.quantity}× <strong>${escapeHtml(i.productName)}</strong>${details ? ` (${escapeHtml(details)})` : ""} — ${formatDKK(i.price)}${fee}</li>`;
  }).join("")}</ul>`;

  const vars = { customerName: escapeHtml(customerName ?? ""), items: itemsHtml, total: formatDKK(orderTotal) };
  await resend.emails.send({
    from: FROM,
    to,
    subject: renderTemplate(subject, vars),
    html: wrapHtml(renderTemplate(bodyTemplate, vars)),
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
