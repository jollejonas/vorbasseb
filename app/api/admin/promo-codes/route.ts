import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import Stripe from "stripe";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function GET() {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  const promoCodes = await stripe.promotionCodes.list({
    limit: 50,
    active: true,
    expand: ["data.promotion.coupon"],
  });

  return NextResponse.json(promoCodes.data);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  // @ts-expect-error custom field
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { code, type, amount, expiryDate, oneTimePerCustomer, maxUses } =
    await req.json();

  if (!code || !type || !amount) {
    return NextResponse.json({ error: "Manglende felter" }, { status: 400 });
  }

  const numAmount = Number(amount);
  if (type === "percent" && (numAmount <= 0 || numAmount > 100)) {
    return NextResponse.json({ error: "Procent skal være 1–100" }, { status: 400 });
  }
  if (type === "fixed" && numAmount <= 0) {
    return NextResponse.json({ error: "Beløb skal være positivt" }, { status: 400 });
  }

  const stripe = getStripe();

  const coupon = await stripe.coupons.create({
    ...(type === "percent"
      ? { percent_off: Number(amount) }
      : {
          amount_off: Math.round(Number(amount) * 100),
          currency: "dkk",
        }),
    duration: "once",
    ...(expiryDate
      ? { redeem_by: Math.floor(new Date(expiryDate).getTime() / 1000) }
      : {}),
  });

  const promoCode = await stripe.promotionCodes.create({
    promotion: { type: "coupon", coupon: coupon.id },
    code: String(code).toUpperCase(),
    ...(oneTimePerCustomer
      ? { restrictions: { first_time_transaction: true } }
      : {}),
    ...(maxUses ? { max_redemptions: Number(maxUses) } : {}),
  });

  return NextResponse.json({ id: promoCode.id, code: promoCode.code });
}
