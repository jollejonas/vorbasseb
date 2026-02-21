"use client";

import Link from "next/link";
import { ShoppingCart, Menu, X, Star } from "lucide-react";
import { useCart } from "./CartProvider";
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/butik", label: "Butik" },
  { href: "/nyheder", label: "Nyheder" },
  { href: "/fanklub", label: "Fanklub" },
];

export function Header() {
  const { totalItems } = useCart();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  // @ts-expect-error custom field
  const isAdmin = session?.user?.role === "ADMIN";
  // @ts-expect-error custom field
  const isMember = session?.user?.subscriptionStatus === "ACTIVE";

  return (
    <header className="sticky top-0 z-50 bg-secondary text-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between h-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-primary">VBK</span>
          <span className="hidden sm:inline">Shop</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover:text-primary transition-colors"
            >
              {l.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-primary hover:text-primary-dark transition-colors"
            >
              Admin
            </Link>
          )}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          {isMember && (
            <span className="hidden sm:flex items-center gap-1 text-xs bg-primary text-secondary font-semibold px-2 py-0.5 rounded-full">
              <Star size={12} /> Medlem
            </span>
          )}

          {session ? (
            <div className="hidden md:flex items-center gap-3 text-sm">
              <Link href="/mine-ordrer" className="hover:text-primary">
                Mine ordrer
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
              className="hidden md:inline text-sm hover:text-primary"
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
        <div className="md:hidden bg-secondary-dark border-t border-white/10 px-4 py-4 flex flex-col gap-4 text-sm font-medium">
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
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => setMenuOpen(false)}
              className="text-primary"
            >
              Admin
            </Link>
          )}
          <hr className="border-white/20" />
          {session ? (
            <>
              <Link
                href="/mine-ordrer"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary"
              >
                Mine ordrer
              </Link>
              <Link
                href="/konto"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary"
              >
                Konto
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-left hover:text-primary"
              >
                Log ud
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary"
              >
                Log ind
              </Link>
              <Link
                href="/registrer"
                onClick={() => setMenuOpen(false)}
                className="hover:text-primary"
              >
                Opret konto
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
