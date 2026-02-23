"use client";

import { useEffect } from "react";
import { useCart } from "./CartProvider";

export function CartClearer() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
