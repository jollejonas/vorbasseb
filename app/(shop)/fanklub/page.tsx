import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Star, Check } from "lucide-react";
import { FanklubSubscribeButton } from "@/components/shop/FanklubSubscribeButton";
import { FaqAccordion } from "@/components/shop/FaqAccordion";
import Link from "next/link";

export const metadata: Metadata = { title: "Fanklub" };

const BENEFITS = [
  "10% rabat på alle køb i butikken",
  "Adgang til eksklusivt fanklubs-merchandise",
  "Støt Vorbasse Boldklub direkte",
  "Kan opsiges til enhver tid",
];

const FAQ_ITEMS = [
  {
    question: "Hvad er inkluderet i medlemskabet?",
    answer:
      "Som fanklubsmedlem får du 10% rabat på alle køb i VBK Shoppen, adgang til eksklusivt merchandise og tidlig adgang til udvalgte produkter. Du støtter desuden Vorbasse Boldklub direkte med dit abonnement.",
  },
  {
    question: "Hvordan bruger jeg min 10% rabat?",
    answer:
      "Rabatten påføres automatisk, når du er logget ind på din konto og går til betaling. Du behøver ikke at gøre noget — rabatkoden aktiveres i kasseforløbet.",
  },
  {
    question: "Kan jeg opsige mit medlemskab?",
    answer:
      "Ja, du kan til enhver tid opsige dit abonnement fra din kontside under 'Fanklubsmedlemskab'. Abonnementet er aktivt indtil slutningen af den betalte periode.",
  },
  {
    question: "Hvornår trækkes betalingen?",
    answer:
      "Betalingen trækkes ved tilmeldingen og fornyes automatisk månedligt eller årligt afhængigt af dit valgte abonnement. Du modtager en e-mail-kvittering ved hver betaling.",
  },
];

export default async function FanklubPage() {
  const session = await auth();

  // Query DB directly — subscriptionStatus is not stored in the JWT
  let isMember = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    });
    isMember = sub?.status === "ACTIVE";
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <Star size={48} className="text-primary mx-auto mb-4" fill="currentColor" />
        <h1 className="text-4xl font-bold mb-4">Vorbasse Boldklub Fanklub</h1>
        <p className="text-gray-500 text-lg">Bliv en del af fællesskabet og støt dit hold</p>
        {isMember && (
          <Link
            href="/fanklub/members"
            className="inline-block mt-5 bg-primary text-secondary font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-primary-dark transition"
          >
            Gå til din medlemsside →
          </Link>
        )}
      </div>

      {isMember ? (
        /* Already a member — don't show pricing cards */
        <div className="text-center py-10 border-2 border-secondary/30 rounded-2xl mb-12">
          <Star size={40} className="text-primary mx-auto mb-3" fill="currentColor" />
          <p className="text-xl font-bold mb-2">Du er allerede fanklubsmedlem!</p>
          <p className="text-gray-500 text-sm mb-5">
            Din 10% rabat er aktiv og du har adgang til eksklusivt indhold.
          </p>
          <Link
            href="/fanklub/members"
            className="inline-block bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
          >
            Gå til din medlemsside
          </Link>
        </div>
      ) : (
        <>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            {/* Monthly */}
            <div className="border-2 border-gray-200 rounded-2xl p-8">
              <h2 className="text-xl font-bold mb-2">Månedligt</h2>
              <div className="text-4xl font-bold text-secondary mb-1">
                49 kr<span className="text-lg font-normal text-gray-500">/md</span>
              </div>
              <p className="text-gray-400 text-sm mb-6">Faktureres månedligt</p>
              <ul className="space-y-3 mb-8 text-left">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <FanklubSubscribeButton plan="monthly" session={session} />
            </div>

            {/* Yearly */}
            <div className="border-2 border-secondary rounded-2xl p-8 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-4 py-1 rounded-full">
                BEDSTE TILBUD
              </div>
              <h2 className="text-xl font-bold mb-2">Årligt</h2>
              <div className="text-4xl font-bold text-secondary mb-1">
                449 kr
                <span className="text-lg font-normal text-gray-500">/år</span>
              </div>
              <p className="text-green-600 text-sm font-medium mb-6">Spar 139 kr ift. månedlig</p>
              <ul className="space-y-3 mb-8 text-left">
                {BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check size={16} className="text-green-500 mt-0.5 shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
              <FanklubSubscribeButton plan="yearly" session={session} />
            </div>
          </div>

          <p className="text-sm text-gray-400 text-center mb-16">
            Abonnementet fornyes automatisk. Du kan til enhver tid opsige fra din kontside.
          </p>
        </>
      )}

      {/* FAQ */}
      <div className="text-left">
        <h2 className="text-2xl font-bold mb-6 text-center">Ofte stillede spørgsmål</h2>
        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </div>
  );
}
