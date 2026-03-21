import Image from "next/image";
import Link from "next/link";
import { Facebook } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { NewsletterForm } from "./NewsletterForm";
import { SponsorCarousel } from "./SponsorCarousel";

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export async function Footer() {
  const [rows, sponsors] = await Promise.all([
    prisma.siteSetting
      .findMany({ where: { key: { in: ["footer_phone", "footer_email", "sponsors_heading"] } } })
      .catch(() => []),
    prisma.sponsor.findMany({ orderBy: { position: "asc" } }).catch(() => []),
  ]);

  const phone = rows.find((r) => r.key === "footer_phone")?.value ?? "+45 XX XX XX XX";
  const email = rows.find((r) => r.key === "footer_email")?.value ?? "shop@vorbassebk.dk";
  const sponsorsHeading = rows.find((r) => r.key === "sponsors_heading")?.value ?? "Støt vores sponsorer";

  return (
    <footer className="bg-secondary text-white mt-16">
      {/* Main footer */}
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
        {/* Left — contact + newsletter */}
        <div className="text-sm space-y-1">
          <p className="font-bold text-base mb-3">VBK Shoppen</p>
          <p className="text-white/90">Telefon: {phone}</p>
          <p className="text-white/90">Email: {email}</p>
          <div className="pt-3 flex flex-col gap-1 text-white/75">
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
          <NewsletterForm />
        </div>

        {/* Centre — brand */}
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-2xl tracking-tight">
            <span className="font-black text-primary">VBK</span>
            <span className="font-light italic text-white">Shoppen</span>
          </span>
          <p className="text-xs text-white/60 mt-1">Officiel merchandise-butik</p>
        </div>

        {/* Right — logo + social */}
        <div className="flex flex-col items-center md:items-end gap-4">
          <Image
            src="/logo.png"
            alt="Vorbasse Boldklub"
            width={90}
            height={90}
          />
          <div className="flex items-center gap-3">
            <a
              href="https://www.facebook.com/vorbasseboldklub"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-primary transition-colors"
              aria-label="Facebook"
            >
              <Facebook size={20} />
            </a>
            <a
              href="https://www.instagram.com/vorbasseboldklub/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <InstagramIcon size={20} />
            </a>
          </div>
        </div>
      </div>

      {/* Sponsor carousel */}
      {sponsors.length > 0 && (
        <div className="border-t border-white/10 py-6 px-4">
          <p className="text-center text-sm text-white/70 mb-4">{sponsorsHeading}</p>
          <SponsorCarousel sponsors={sponsors} />
        </div>
      )}

      {/* Payment logos */}
      <div className="border-t border-white/10">
        <p className="text-center text-white/60 text-xs tracking-wide py-2">
          MobilePay · Visa · Mastercard
        </p>
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
