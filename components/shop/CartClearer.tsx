"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

export function CartClearer() {
  const { clearCart } = useCart();
  useEffect(() => {
    // Remove from localStorage first so CartProvider's hydration effect
    // (which runs after child effects) doesn't restore the old items.
    localStorage.removeItem("vbk_cart");
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
