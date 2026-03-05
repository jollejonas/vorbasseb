import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { SportsTicker } from "@/components/shop/SportsTicker";
import { CookieBanner } from "@/components/shop/CookieBanner";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <SportsTicker />
      <main className="min-h-screen">{children}</main>
      <Footer />
      <CookieBanner />
    </>
  );
}
