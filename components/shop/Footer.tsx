import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export async function Footer() {
  const rows = await prisma.siteSetting
    .findMany({ where: { key: { in: ["footer_phone", "footer_email"] } } })
    .catch(() => []);

  const phone = rows.find((r) => r.key === "footer_phone")?.value ?? "+45 XX XX XX XX";
  const email = rows.find((r) => r.key === "footer_email")?.value ?? "shop@vorbassebk.dk";

  return (
    <footer className="bg-secondary text-white mt-16">
      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left — contact */}
        <div className="text-sm space-y-1">
          <p className="font-bold text-base mb-3">VBK Shoppen</p>
          <p className="text-white/70">Telefon: {phone}</p>
          <p className="text-white/70">Email: {email}</p>
          <div className="pt-3 flex flex-col gap-1 text-white/60">
            <Link href="/handelsbetingelser" className="hover:text-primary transition-colors">
              Handelsbetingelser
            </Link>
            <Link href="/retur" className="hover:text-primary transition-colors">
              Retur og ombytning
            </Link>
            <Link href="/privatlivspolitik" className="hover:text-primary transition-colors">
              Privatlivs- og persondatapolitik
            </Link>
          </div>
        </div>

        {/* Centre — brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl tracking-tight">
            <span className="font-black text-primary">VBK</span>
            <span className="font-light italic text-white">Shoppen</span>
          </span>
          <p className="text-xs text-white/50 mt-1">Officiel merchandise-butik</p>
        </div>

        {/* Right — logo */}
        <div className="flex justify-center md:justify-end">
          <Image
            src="/logo.png"
            alt="Vorbasse Boldklub"
            width={90}
            height={90}
          />
        </div>
      </div>

      {/* Yellow bottom strip */}
      <div className="bg-primary">
        <div className="max-w-6xl mx-auto px-4 py-3 text-center">
          <p className="text-secondary text-xs font-semibold">
            Copyright © {new Date().getFullYear()} – Vorbasse Boldklub – Alle rettigheder forbeholdes
          </p>
        </div>
      </div>
    </footer>
  );
}
