import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const priceId = process.env.STRIPE_PRICE_YEARLY;

  if (!priceId) {
    console.error("[subscribe] Missing env var: STRIPE_PRICE_YEARLY");
    return NextResponse.json({ error: "Abonnement ikke konfigureret" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: session.user.email ?? undefined,
      metadata: { userId: session.user.id },
      subscription_data: {
        metadata: { userId: session.user.id },
      },
      success_url: `${baseUrl}/fanklub/tak`,
      cancel_url: `${baseUrl}/fanklub`,
      locale: "da",
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[subscribe] Stripe error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
