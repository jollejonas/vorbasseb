import { CheckCircle } from "lucide-react";
import Link from "next/link";
import { CartClearer } from "@/components/shop/CartClearer";
import Stripe from "stripe";
import { fulfillOrder } from "@/lib/fulfillOrder";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export default async function OrdrebekraefdelsePage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; order_id?: string }>;
}) {
  const { session_id, order_id } = await searchParams;
  let paymentConfirmed = false;
  let orderConfirmed = false;
  if (order_id) {
    const userSession = await auth();
    if (userSession?.user?.id) {
      orderConfirmed = paymentConfirmed = !!await prisma.order.findFirst({ where: {
        id: order_id, userId: userSession.user.id, total: 0, status: "PAID", orderNumber: { not: null },
      } });
    }
  }

  // Fallback fulfillment — in case the webhook hasn't fired yet
  if (session_id) {
    try {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      const session = await stripe.checkout.sessions.retrieve(session_id);
      paymentConfirmed = session.mode === "payment" && session.status === "complete" && ["paid", "no_payment_required"].includes(session.payment_status);
      await fulfillOrder(session);
      if (paymentConfirmed && session.metadata?.orderId) {
        orderConfirmed = !!await prisma.order.findFirst({ where: {
          id: session.metadata.orderId, stripeSessionId: session.id,
          status: { not: "PENDING" }, orderNumber: { not: null },
        } });
      }
    } catch (err) {
      console.error("[ordre-bekraeftelse] fulfillOrder failed:", err);
    }
  }

  if (!paymentConfirmed) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Betalingen er ikke bekræftet endnu</h1>
      <p>Hvis du netop har betalt, kan du opdatere siden om et øjeblik. Din kurv er bevaret.</p>
      <Link href="/kurv" className="text-secondary underline">Tilbage til kurven</Link>
    </div>
  );

  if (!orderConfirmed) return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
      <h1 className="text-2xl font-bold">Betalingen er registreret</h1>
      <p>Vi mangler at færdigbehandle din ordre. Du skal ikke betale igen. Opdatér denne side om et øjeblik, eller kontakt klubben, hvis beskeden bliver ved med at vises.</p>
    </div>
  );

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <CartClearer />
      <div className="text-center max-w-md">
        <CheckCircle size={64} className="text-green-500 mx-auto mb-6" />
        <h1 className="text-3xl font-bold mb-3">Tak for din ordre!</h1>
        <p className="text-gray-500 mb-8">
          Du modtager snart en bekræftelse på e-mail. Vi sender din ordre hurtigst muligt.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/mine-ordrer"
            className="bg-secondary text-white font-semibold px-6 py-3 rounded-xl hover:bg-secondary-dark transition"
          >
            Se mine ordrer
          </Link>
          <Link
            href="/butik"
            className="border border-gray-200 text-gray-700 font-semibold px-6 py-3 rounded-xl hover:border-secondary transition"
          >
            Fortsæt med at handle
          </Link>
        </div>
      </div>
    </div>
  );
}
