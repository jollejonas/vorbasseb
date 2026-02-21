"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "./shop/CartProvider";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>{children}</CartProvider>
    </SessionProvider>
  );
}
