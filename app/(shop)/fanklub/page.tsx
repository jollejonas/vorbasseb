import { Metadata } from "next";
import { auth } from "@/auth";
import { Star, Check } from "lucide-react";
import { FanklubSubscribeButton } from "@/components/shop/FanklubSubscribeButton";

export const metadata: Metadata = { title: "Fanklub" };

const BENEFITS = [
  "10% rabat på alle køb i butikken",
  "Adgang til eksklusivt fanklubs-merchandise",
  "Støt Vorbasse Boldklub direkte",
  "Kan opsiges til enhver tid",
];

export default async function FanklubPage() {
  const session = await auth();

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 text-center">
      <Star
        size={48}
        className="text-primary mx-auto mb-4"
        fill="currentColor"
      />
      <h1 className="text-4xl font-bold mb-4">Vorbasse Boldklub Fanklub</h1>
      <p className="text-gray-500 text-lg mb-10">
        Bliv en del af fællesskabet og støt dit hold
      </p>

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
          <p className="text-green-600 text-sm font-medium mb-6">
            Spar 139 kr ift. månedlig
          </p>
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

      <p className="text-sm text-gray-400">
        Abonnementet fornyes automatisk. Du kan til enhver tid opsige fra din
        kontside.
      </p>
    </div>
  );
}
