import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function OrdrebekraefdelsePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
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
