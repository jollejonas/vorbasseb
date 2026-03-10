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
  ChevronDown,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

type NavSubGroup = {
  label: string;
  items: NavItem[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
  subGroup?: NavSubGroup;
};

function buildGroups(attentionCount: number): NavGroup[] {
  return [
    {
      label: "Butik",
      items: [
        { href: "/admin/produkter", label: "Produkter", icon: Package, badge: attentionCount || undefined },
        { href: "/admin/ordrer", label: "Ordrer", icon: ShoppingBag },
        { href: "/admin/rabatkoder", label: "Rabatkoder", icon: Tag },
      ],
      subGroup: {
        label: "Produkt opsætning",
        items: [
          { href: "/admin/farver", label: "Farvebibliotek", icon: Palette },
          { href: "/admin/tilvalg", label: "Tilvalg", icon: ListPlus },
          { href: "/admin/designer-logoer", label: "Designer-logoer", icon: Image },
        ],
      },
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
      label: "Økonomi",
      items: [
        { href: "/admin/oekonomi", label: "Økonomi", icon: TrendingUp },
      ],
    },
    {
      label: "Opsætning",
      items: [
        { href: "/admin/indstillinger#generelt", label: "Generelt", icon: Settings },
        { href: "/admin/indstillinger#hero-carousel", label: "Hero-carousel", icon: Settings },
        { href: "/admin/indstillinger#email-skabeloner", label: "E-mail skabeloner", icon: Settings },
      ],
    },
  ];
}

const SETUP_PATHS = ["/admin/farver", "/admin/tilvalg", "/admin/designer-logoer"];

function SidebarContent({
  groups,
  pathname,
  onClose,
}: {
  groups: NavGroup[];
  pathname: string;
  onClose?: () => void;
}) {
  const [openSubGroup, setOpenSubGroup] = useState<string | null>(() =>
    SETUP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))
      ? "Produkt opsætning"
      : null
  );

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
                const itemPath = item.href.split("#")[0];
                const active = pathname === itemPath || pathname.startsWith(itemPath + "/");
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

            {/* Collapsible sub-group */}
            {group.subGroup && (() => {
              const sg = group.subGroup!;
              const isOpen = openSubGroup === sg.label;
              const anyActive = sg.items.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
              return (
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setOpenSubGroup(isOpen ? null : sg.label)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition ${
                      anyActive ? "text-primary" : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    {sg.label}
                    <ChevronDown
                      size={12}
                      className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {isOpen && (
                    <ul className="space-y-0.5 pl-3 border-l border-white/10 ml-3 mt-0.5">
                      {sg.items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <li key={item.href}>
                            <Link
                              href={item.href}
                              onClick={onClose}
                              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                                active
                                  ? "bg-primary text-secondary"
                                  : "text-white/70 hover:bg-white/10 hover:text-white"
                              }`}
                            >
                              <item.icon size={14} className={active ? "text-secondary" : "text-white/50"} />
                              {item.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })()}
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
