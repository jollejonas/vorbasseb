"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Menu, X, Star } from "lucide-react";
import { useCart } from "./CartProvider";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/nyheder", label: "NYHEDER" },
  { href: "/butik?kategori=spillertoj", label: "SPILLERTØJ" },
  { href: "/butik?kategori=traeningtoj", label: "TRÆNINGSTØJ" },
  { href: "/butik?kategori=fritidstoj", label: "FRITIDSTØJ" },
  { href: "/butik?kategori=tilbehor", label: "TILBEHØR" },
  { href: "/fanklub", label: "FANKLUB" },
];

export function Header() {
  const { totalItems } = useCart();
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // @ts-expect-error custom field
  const isAdmin = session?.user?.role === "ADMIN";
  // @ts-expect-error custom field
  const isMember = session?.user?.subscriptionStatus === "ACTIVE";
  // @ts-expect-error custom field
  const isTrainer = session?.user?.clubRole === "TRAINER";

  return (
    <header className="sticky top-0 z-50 bg-[#0a0f1e] text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          <span className="text-xl tracking-tight">
            <span className="font-black text-primary">VBK</span>
            <span className="font-light italic text-white">Shoppen</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-bold tracking-widest">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {isTrainer && (
            <Link
              href="/traener"
              className="text-primary hover:text-primary-dark transition-colors"
            >
              TRÆNERE
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-primary hover:text-primary-dark transition-colors"
            >
              ADMIN
            </Link>
          )}
        </nav>

        {/* Actions + logo */}
        <div className="flex items-center gap-3">
          {isMember && (
            <span className="hidden sm:flex items-center gap-1 text-xs bg-primary text-secondary font-semibold px-2 py-0.5 rounded-full">
              <Star size={12} /> Medlem
            </span>
          )}

          {status === "loading" ? (
            <div className="hidden md:block w-20 h-5" />
          ) : session ? (
            <div className="hidden md:flex items-center gap-3 text-xs">
              <Link href="/mine-ordrer" className="hover:text-primary">
                Mine ordrer
              </Link>
              <Link href="/konto" className="hover:text-primary">
                Konto
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hover:text-primary"
              >
                Log ud
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="hidden md:inline text-xs hover:text-primary"
            >
              Log ind
            </Link>
          )}

          <Link
            href="/kurv"
            className="relative flex items-center justify-center w-10 h-10 hover:text-primary transition-colors"
          >
            <ShoppingCart size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-secondary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {totalItems > 9 ? "9+" : totalItems}
              </span>
            )}
          </Link>

          {/* Club logo */}
          <Link href="/" className="hidden md:block shrink-0">
            <Image
              src="/logo.png"
              alt="Vorbasse Boldklub"
              width={40}
              height={40}
              className="rounded-full"
            />
          </Link>

          {/* Mobile menu toggle */}
          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Åbn menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden bg-[#060b15] border-t border-white/10 px-4 py-4 flex flex-col gap-4 text-sm font-bold tracking-wider">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="hover:text-primary"
            >
              {l.label}
            </Link>
          ))}
          {isTrainer && (
            <Link
              href="/traener"
              onClick={() => setMenuOpen(false)}
              className="text-primary"
            >
              TRÆNERE
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="text-primary"
            >
              ADMIN
            </Link>
          )}
          <hr className="border-white/20" />
          {status !== "loading" && (session ? (
            <>
              <Link
                href="/mine-ordrer"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary font-normal"
              >
                Mine ordrer
              </Link>
              <Link
                href="/konto"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary font-normal"
              >
                Konto
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-left hover:text-primary font-normal"
              >
                Log ud
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary font-normal"
              >
                Log ind
              </Link>
              <Link
                href="/registrer"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary font-normal"
              >
                Opret konto
              </Link>
            </>
          ))}
        </div>
      )}
    </header>
  );
}
