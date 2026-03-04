"use client";

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from "react";

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
  return `${item.skuId}::${item.customName ?? ""}::${item.customNumber ?? ""}::${item.colorName ?? ""}`;
}

type CartContextValue = {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (item: CartItem) => void;
  updateQty: (item: CartItem, qty: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number; // øre
};

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = "vbk_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "INIT", items: JSON.parse(raw) });
    } catch {}
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
  }, [state.items]);

  const value: CartContextValue = {
    items: state.items,
    addItem: (item) => dispatch({ type: "ADD", item }),
    removeItem: (item) => dispatch({ type: "REMOVE", key: itemKey(item) }),
    updateQty: (item, quantity) => dispatch({ type: "UPDATE_QTY", key: itemKey(item), quantity }),
    clearCart: () => dispatch({ type: "CLEAR" }),
    totalItems: state.items.reduce((s, i) => s + i.quantity, 0),
    subtotal: state.items.reduce(
      (s, i) =>
        s + (i.price + (i.customizationFee ?? 0)) * i.quantity,
      0,
    ),
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
