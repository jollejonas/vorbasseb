import { Star } from "lucide-react";
import Link from "next/link";

export default function FanklubTakPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <Star size={64} className="text-primary mx-auto mb-6" fill="currentColor" />
        <h1 className="text-3xl font-bold mb-3">Velkommen som fanklubsmedlem!</h1>
        <p className="text-gray-500 mb-2">
          Du er nu en del af Vorbasse Boldklub Fanklub.
        </p>
        <p className="text-gray-500 mb-8">
          Din 10% rabat er aktiveret og eksklusivt merchandise er nu tilgængeligt for dig.
        </p>
        <Link
          href="/butik"
          className="inline-block bg-primary text-secondary font-bold px-8 py-3 rounded-xl hover:bg-primary-dark transition"
        >
          Gå til butikken
        </Link>
      </div>
    </div>
  );
}
