"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Package,
  ShoppingBag,
  Tag,
  Newspaper,
  Mail,
  Trophy,
  Shirt,
  Users,
  Palette,
  ListPlus,
  Settings,
  Menu,
  X,
  AlertTriangle,
  Image,
  TrendingUp,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

function buildGroups(attentionCount: number): NavGroup[] {
  return [
    {
      label: "Butik",
      items: [
        { href: "/admin/produkter", label: "Produkter", icon: Package, badge: attentionCount || undefined },
        { href: "/admin/ordrer", label: "Ordrer", icon: ShoppingBag },
        { href: "/admin/rabatkoder", label: "Rabatkoder", icon: Tag },
        { href: "/admin/farver", label: "Farvebibliotek", icon: Palette },
        { href: "/admin/tilvalg", label: "Tilvalg", icon: ListPlus },
        { href: "/admin/designer-logoer", label: "Designer-logoer", icon: Image },
      ],
    },
    {
      label: "Indhold",
      items: [
        { href: "/admin/nyheder", label: "Nyheder", icon: Newspaper },
        { href: "/admin/nyhedsbrev", label: "Nyhedsbrev", icon: Mail },
        { href: "/admin/kampe", label: "Kampe", icon: Trophy },
      ],
    },
    {
      label: "Klub",
      items: [
        { href: "/admin/traener", label: "Trænere", icon: Shirt },
        { href: "/admin/brugere", label: "Brugere", icon: Users },
      ],
    },
    {
      label: "Opsætning",
      items: [
        { href: "/admin/indstillinger", label: "Indstillinger", icon: Settings },
        { href: "/admin/oekonomi", label: "Økonomi", icon: TrendingUp },
      ],
    },
  ];
}

function SidebarContent({
  groups,
  pathname,
  onClose,
}: {
  groups: NavGroup[];
  pathname: string;
  onClose?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-white/10">
        <Link href="/admin" className="flex items-center gap-2" onClick={onClose}>
          <span className="text-primary font-black text-lg tracking-tight">VBK</span>
          <span className="text-white/60 text-sm font-medium">Admin</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="text-white/60 hover:text-white md:hidden">
            <X size={20} />
          </button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest px-2 mb-1">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        active
                          ? "bg-primary text-secondary"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <item.icon size={16} className={active ? "text-secondary" : "text-white/50"} />
                        {item.label}
                      </span>
                      {item.badge ? (
                        <span className="flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] justify-center">
                          <AlertTriangle size={10} />
                          {item.badge > 99 ? "99+" : item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10">
        <Link
          href="/"
          className="text-xs text-white/40 hover:text-white/70 transition"
          onClick={onClose}
        >
          ← Tilbage til shoppen
        </Link>
      </div>
    </div>
  );
}

export function AdminSidebar({ attentionCount }: { attentionCount: number }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const groups = buildGroups(attentionCount);

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden bg-secondary text-white p-2 rounded-lg shadow-lg"
        aria-label="Åbn menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-56 bg-secondary flex flex-col transform transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent
          groups={groups}
          pathname={pathname}
          onClose={() => setMobileOpen(false)}
        />
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-secondary min-h-screen sticky top-0 h-screen">
        <SidebarContent groups={groups} pathname={pathname} />
      </aside>
    </>
  );
}
