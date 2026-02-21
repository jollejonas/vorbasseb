import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });
  }

  const { plan }: { plan: "monthly" | "yearly" } = await req.json();

  const priceId =
    plan === "yearly"
      ? process.env.STRIPE_PRICE_YEARLY!
      : process.env.STRIPE_PRICE_MONTHLY!;

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

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
}
