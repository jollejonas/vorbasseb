"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";

export type OptionSelection = { groupLabel: string; value: string };

export type PrintElement = {
  side: "front" | "back";
  zoneId: number;
  zoneLabel: string;
  position: string;
  type: "text" | "logo";
  value: string; // text content or logoId (stringified)
  logoUrl?: string;
  fontSize: "small" | "medium" | "large";
};

export type PakketilbudItemSelection = {
  itemId: string;
  productId: string;
  productName: string;
  label?: string;
  skuId: string;
  size: string;
  colorName?: string;
  optionSelections?: OptionSelection[];
  customName?: string;
  customNumber?: string;
  customizationFee?: number;
  printElements?: PrintElement[];
};

export type CartItem = {
  skuId: string;
  productId: string;
  productName: string;
  size: string;
  price: number; // øre
  quantity: number;
  image?: string;
  customName?: string;
  customNumber?: string;
  customizationFee?: number; // øre
  clubRoleRequired?: string | null; // null/undefined = public product; "TRAINER" = trainer-only
  colorName?: string;
  optionSelections?: OptionSelection[]; // snapshot of TEXT/SELECT/CUSTOM selections
  printElements?: PrintElement[]; // jersey designer print specs
  isPakketilbud?: boolean;
  pakketilbudId?: string; // ID of the Pakketilbud (for sale price checking)
  pakketilbudItems?: PakketilbudItemSelection[];
  isOnSale?: boolean; // true when an active sale price was used at add-to-cart time
  isGroupOrder?: boolean; // true if this item is part of a samlebestilling
  groupOrderDeadline?: string | null; // ISO string — deadline for the group order
};

type CartState = { items: CartItem[] };

type Action =
  | { type: "ADD"; item: CartItem }
  | { type: "REMOVE"; key: string }
  | { type: "UPDATE_QTY"; key: string; quantity: number }
  | { type: "CLEAR" }
  | { type: "INIT"; items: CartItem[] };

function reducer(state: CartState, action: Action): CartState {
  switch (action.type) {
    case "INIT":
      return { items: action.items };
    case "ADD": {
      const key = itemKey(action.item);
      const existing = state.items.find((i) => itemKey(i) === key);
      if (existing) {
        return {
          items: state.items.map((i) =>
            itemKey(i) === key
              ? { ...i, quantity: i.quantity + action.item.quantity }
              : i,
          ),
        };
      }
      return { items: [...state.items, action.item] };
    }
    case "REMOVE":
      return { items: state.items.filter((i) => itemKey(i) !== action.key) };
    case "UPDATE_QTY":
      return {
        items: state.items.map((i) =>
          itemKey(i) === action.key ? { ...i, quantity: action.quantity } : i,
        ),
      };
    case "CLEAR":
      return { items: [] };
    default:
      return state;
  }
}

function itemKey(item: CartItem) {
  if (item.isPakketilbud) {
    const parts = (item.pakketilbudItems ?? [])
      .map((c) => `${c.productId}:${c.skuId}:${c.customName ?? ""}:${c.customNumber ?? ""}`)
      .join("|");
    return `pakke::${item.productId}::${parts}`;
  }
  const selections = item.optionSelections?.map((s) => `${s.groupLabel}=${s.value}`).join(",") ?? "";
  const prints = item.printElements?.map((p) => `${p.side}:${p.zoneId}:${p.type}:${p.value}:${p.fontSize}`).join(",") ?? "";
  return `${item.skuId}::${item.customName ?? ""}::${item.customNumber ?? ""}::${item.colorName ?? ""}::${selections}::${prints}`;
}

function normalizeCartItems(input: unknown): CartItem[] {
  if (!Array.isArray(input)) return [];

  return input
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => {
      const rawQty = typeof item.quantity === "number" ? Math.trunc(item.quantity) : 1;
      const quantity = Number.isFinite(rawQty) ? Math.max(1, rawQty) : 1;
      return { ...(item as CartItem), quantity };
    });
}

function readLocalCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return normalizeCartItems(JSON.parse(raw));
  } catch {
    return [];
  }
}

function mergeCartItems(localItems: CartItem[], serverItems: CartItem[]): CartItem[] {
  const merged = new Map<string, CartItem>();

  for (const item of [...serverItems, ...localItems]) {
    const key = itemKey(item);
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, { ...item, quantity: existing.quantity + item.quantity });
      continue;
    }
    merged.set(key, item);
  }

  return Array.from(merged.values());
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (item: CartItem) => void;
  updateQty: (item: CartItem, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number; // øre, excl. VAT
  vatPct: number;
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "vbk_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [vatPct, setVatPct] = useState(25);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncReadyUserId, setSyncReadyUserId] = useState<string | null>(null);
  const userId = session?.user?.id ?? null;

  // Hydrate from localStorage
  useEffect(() => {
    dispatch({ type: "INIT", items: readLocalCart() });
    setIsHydrated(true);
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {}
  }, [isHydrated, state.items]);

  // On login/session load, merge local cart with server cart.
  useEffect(() => {
    if (!isHydrated) return;

    if (status !== "authenticated" || !userId) {
      setSyncReadyUserId(null);
      return;
    }

    let cancelled = false;
    setSyncReadyUserId(null);

    void (async () => {
      try {
        const res = await fetch("/api/cart", { cache: "no-store" });
        const data = res.ok ? await res.json() : null;
        const serverItems = normalizeCartItems(data?.items);
        const localItems = readLocalCart();
        const merged = mergeCartItems(localItems, serverItems);
        if (!cancelled) dispatch({ type: "INIT", items: merged });
      } catch {
        // Keep local cart if server fetch fails.
      } finally {
        if (!cancelled) setSyncReadyUserId(userId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isHydrated, status, userId]);

  // Sync authenticated cart mutations to the server.
  useEffect(() => {
    if (!isHydrated) return;
    if (status !== "authenticated" || !userId) return;
    if (syncReadyUserId !== userId) return;

    void fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: state.items }),
    }).catch(() => {});
  }, [isHydrated, status, userId, syncReadyUserId, state.items]);

  // Fetch VAT rate once
  useEffect(() => {
    fetch("/api/vat-rate")
      .then((r) => r.json())
      .then((d) => { if (typeof d.vatPct === "number") setVatPct(d.vatPct); })
      .catch(() => {});
  }, []);

  const clearCart = () => {
    dispatch({ type: "CLEAR" });

    if (status !== "authenticated" || !userId || syncReadyUserId !== userId) return;
    void fetch("/api/cart", { method: "DELETE" }).catch(() => {});
  };

  const value: CartContextValue = {
    items: state.items,
    addItem: (item) => dispatch({ type: "ADD", item }),
    removeItem: (item) => dispatch({ type: "REMOVE", key: itemKey(item) }),
    updateQty: (item, quantity) => dispatch({ type: "UPDATE_QTY", key: itemKey(item), quantity }),
    clearCart,
    totalItems: state.items.reduce((s, i) => s + i.quantity, 0),
    subtotal: state.items.reduce(
      (s, i) =>
        s + (i.price + (i.customizationFee ?? 0)) * i.quantity,
      0,
    ),
    vatPct,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
