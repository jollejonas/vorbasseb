import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@vorbassebk.dk";

function formatDKK(ore: number) {
  return new Intl.NumberFormat("da-DK", {
    style: "currency",
    currency: "DKK",
  }).format(ore / 100);
}

type OrderItem = {
  skuId: string;
  quantity: number;
  price: number;
  customName: string;
  customNumber: string;
  customizationFee: number;
};

export async function sendOrderConfirmation({
  to,
  orderTotal,
  items,
}: {
  to: string;
  orderTotal: number;
  items: OrderItem[];
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Ordrebekræftelse – Vorbasse Boldklub",
    html: `
      <h2>Tak for din ordre! 💛💙</h2>
      <p>Vi har modtaget din bestilling og sender den snarest.</p>
      <h3>Ordresammenfatning</h3>
      <ul>
        ${items
          .map(
            (i) =>
              `<li>${i.quantity}x (${formatDKK(i.price + i.customizationFee)})
                ${i.customName ? ` – Tryk: ${i.customName}` : ""}
                ${i.customNumber ? ` #${i.customNumber}` : ""}
              </li>`,
          )
          .join("")}
      </ul>
      <p><strong>Total betalt: ${formatDKK(orderTotal)}</strong></p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `,
  });
}

export async function sendShippingNotification({
  to,
  orderId,
}: {
  to: string;
  orderId: string;
}) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Din ordre er afsendt – Vorbasse Boldklub",
    html: `
      <h2>Din ordre er på vej! 🚚</h2>
      <p>Vi har afsendt din ordre (${orderId}).</p>
      <p>Forventet leveringstid: 2–5 hverdage.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `,
  });
}

export async function sendFanklubWelcome({ to }: { to: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Velkommen som fanklubsmedlem! 🌟",
    html: `
      <h2>Velkommen til Vorbasse Boldklub Fanklub!</h2>
      <p>Du har nu adgang til følgende fordele:</p>
      <ul>
        <li>✅ 10% rabat på alle køb i butikken</li>
        <li>✅ Adgang til eksklusivt fanklubs-merchandise</li>
      </ul>
      <p>Rabatten påføres automatisk ved næste køb.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `,
  });
}

export async function sendPaymentFailed({ to }: { to: string }) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Betalingsfejl på dit fanklubsabonnement",
    html: `
      <h2>Betaling mislykkedes</h2>
      <p>Vi kunne desværre ikke trække betaling for dit fanklubsabonnement.</p>
      <p>Opdater venligst din betalingsmetode for at bevare dine medlemsfordele.</p>
      <hr />
      <p>Mvh. Vorbasse Boldklub</p>
    `,
  });
}

export async function sendLowStockAlert(
  productName: string,
  size: string,
  stock: number,
) {
  const adminTo =
    process.env.ADMIN_EMAIL ?? process.env.RESEND_FROM_EMAIL ?? FROM;
  await resend.emails.send({
    from: FROM,
    to: adminTo,
    subject: `Lav lagerstatus: ${productName} (${size})`,
    html: `
      <h2>Lav lagerstatus</h2>
      <p>Produktet <strong>${productName}</strong>, størrelse <strong>${size}</strong>, har kun <strong>${stock}</strong> ${stock === 1 ? "enhed" : "enheder"} tilbage på lageret.</p>
      <p>Genopfyld venligst lageret snarest.</p>
      <hr />
      <p>VBK Shoppen – automatisk besked</p>
    `,
  });
}
