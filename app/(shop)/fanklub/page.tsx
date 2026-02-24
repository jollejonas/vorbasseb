import { Metadata } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Star, Check, Clock, Trophy } from "lucide-react";
import { FanklubSubscribeButton } from "@/components/shop/FanklubSubscribeButton";
import { FaqAccordion } from "@/components/shop/FaqAccordion";
import Link from "next/link";

export const metadata: Metadata = { title: "ForzaHestene – Fanklub" };

const BENEFITS = [
  {
    title: "Stadionplatter",
    description:
      "Du får 4 x stadionplatte-kuponer, som du kan bruge på dig selv, eller dele med dine nærmeste.",
  },
  {
    title: "ForzaHestene T-Shirt",
    description:
      "Som medlem af ForzaHestene får du en helt unik ForzaHestene T-Shirt.",
  },
  {
    title: "10% rabat i butikken",
    description:
      "Medlemmer får 10% rabat på alle køb i VBK Shoppen — rabatten påføres automatisk ved betaling.",
  },
];

const COMING_SOON = [
  {
    title: "Fordelskort",
    description:
      "Vi ønsker at få lavet fordelskort, hvor man får muligheden for at få en række fordele hos flere af vores sponsorer.",
  },
  {
    title: "Eksklusivt merchandise",
    description:
      "Vi ønsker at få lavet en særlig merchandise-kollektion til Vorbasse Boldklub. Her vil medlemmer af ForzaHestene få en ekstra rabat.",
  },
  {
    title: "Fodboldture",
    description:
      "Som en del af vores samarbejde med FC Midtjylland vil vi arbejde på at kunne invitere både spillere, trænere men også ForzaHestene med til gode fodboldoplevelser på MCH Arena.",
  },
];

const FAQ_ITEMS = [
  {
    question: "Hvad er inkluderet i medlemskabet?",
    answer:
      "Som ForzaHestene-medlem får du stadionplatte-kuponer, en eksklusiv ForzaHestene T-Shirt, 10% rabat på alle køb i VBK Shoppen samt adgang til kommende fordele, når de lanceres.",
  },
  {
    question: "Hvordan bruger jeg min 10% rabat?",
    answer:
      "Rabatten påføres automatisk, når du er logget ind på din konto og går til betaling. Du behøver ikke gøre noget — rabatkoden aktiveres i kasseforløbet.",
  },
  {
    question: "Kan jeg opsige mit medlemskab?",
    answer:
      "Ja, du kan til enhver tid opsige dit abonnement fra din kontoside under 'Fanklubsmedlemskab'. Abonnementet er aktivt indtil slutningen af den betalte periode.",
  },
  {
    question: "Hvornår trækkes betalingen?",
    answer:
      "Betalingen trækkes ved tilmeldingen og fornyes automatisk månedligt eller årligt afhængigt af dit valgte abonnement. Du modtager en e-mail-kvittering ved hver betaling.",
  },
];

export default async function FanklubPage() {
  const session = await auth();

  let isMember = false;
  if (session?.user?.id) {
    const sub = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { status: true },
    });
    isMember = sub?.status === "ACTIVE";
  }

  return (
    <div>
      {/* Branded header */}
      <div className="bg-[#0a0f1e] text-white py-12 px-4">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end gap-4 justify-between">
          <div>
            <p className="text-primary text-xs font-bold uppercase tracking-widest mb-2">
              Vorbasse Boldklub
            </p>
            <h1 className="text-4xl md:text-5xl font-black uppercase leading-none tracking-tight">
              ForzaHestene
            </h1>
            <p className="text-white/55 mt-2 text-sm uppercase tracking-wider">Support Gruppe</p>
          </div>
          {isMember && (
            <Link
              href="/fanklub/members"
              className="inline-flex items-center gap-2 bg-primary text-secondary font-bold px-6 py-2.5 rounded-xl text-sm hover:bg-primary-dark transition shrink-0"
            >
              <Star size={15} fill="currentColor" /> Din medlemsside →
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-12">

        {/* Intro */}
        <div className="max-w-2xl mb-14">
          <p className="text-gray-600 text-lg leading-relaxed">
            Som en del af branding-strategien for Vorbasse Boldklub har vi valgt at oprette en
            support-gruppe for klubben. ForzaHestene er for alle, der brænder for Vorbasse Boldklub
            og ønsker at støtte holdet på og uden for banen.
          </p>
        </div>

        {/* Current benefits */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-6">Som medlem får du</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-gray-100 bg-[#f9f9f9]"
              >
                <Check size={20} className="text-primary shrink-0" />
                <p className="font-bold">{b.title}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Coming soon */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold mb-1">Vi arbejder på</h2>
          <p className="text-gray-400 text-sm mb-6">Kommende fordele for alle ForzaHestene-medlemmer</p>
          <div className="grid md:grid-cols-3 gap-4">
            {COMING_SOON.map((b) => (
              <div
                key={b.title}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-dashed border-gray-200"
              >
                <div className="flex items-center gap-2 text-gray-400">
                  <Clock size={14} />
                  <span className="text-xs font-bold uppercase tracking-wider">Kommer snart</span>
                </div>
                <p className="font-bold">{b.title}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{b.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        {isMember ? (
          <div className="text-center py-12 border-2 border-secondary/20 rounded-2xl mb-14">
            <Star size={40} className="text-primary mx-auto mb-3" fill="currentColor" />
            <p className="text-xl font-bold mb-2">Du er allerede ForzaHestene-medlem!</p>
            <p className="text-gray-500 text-sm mb-6">
              Din 10% rabat er aktiv og du har adgang til alle fordele.
            </p>
            <Link
              href="/fanklub/members"
              className="inline-block bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
            >
              Gå til din medlemsside
            </Link>
          </div>
        ) : (
          <section className="mb-14">
            <h2 className="text-2xl font-bold mb-6">Meld dig ind i ForzaHestene</h2>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Monthly */}
              <div className="border-2 border-gray-200 rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-2">Månedligt</h3>
                <div className="text-4xl font-bold text-secondary mb-1">
                  49 kr<span className="text-lg font-normal text-gray-500">/md</span>
                </div>
                <p className="text-gray-400 text-sm mb-6">Faktureres månedligt · opsiges til enhver tid</p>
                <ul className="space-y-3 mb-8 text-left">
                  {BENEFITS.map((b) => (
                    <li key={b.title} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-primary mt-0.5 shrink-0" />
                      {b.title}
                    </li>
                  ))}
                </ul>
                <FanklubSubscribeButton plan="monthly" session={session} />
              </div>

              {/* Yearly */}
              <div className="border-2 border-secondary rounded-2xl p-8 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-secondary text-white text-xs font-bold px-4 py-1 rounded-full flex items-center gap-1.5">
                  <Trophy size={11} /> BEDSTE TILBUD
                </div>
                <h3 className="text-xl font-bold mb-2">Årligt</h3>
                <div className="text-4xl font-bold text-secondary mb-1">
                  449 kr<span className="text-lg font-normal text-gray-500">/år</span>
                </div>
                <p className="text-green-600 text-sm font-medium mb-6">Spar 139 kr ift. månedlig</p>
                <ul className="space-y-3 mb-8 text-left">
                  {BENEFITS.map((b) => (
                    <li key={b.title} className="flex items-start gap-2 text-sm">
                      <Check size={16} className="text-primary mt-0.5 shrink-0" />
                      {b.title}
                    </li>
                  ))}
                </ul>
                <FanklubSubscribeButton plan="yearly" session={session} />
              </div>
            </div>
            <p className="text-sm text-gray-400 text-center mt-4">
              Abonnementet fornyes automatisk. Du kan til enhver tid opsige fra din kontoside.
            </p>
          </section>
        )}

        {/* FAQ */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-center">Ofte stillede spørgsmål</h2>
          <FaqAccordion items={FAQ_ITEMS} />
        </section>

      </div>
    </div>
  );
}
