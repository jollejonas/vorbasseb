import type { Metadata } from "next";
import { Share } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { SportsTicker } from "@/components/shop/SportsTicker";
import { CookieBanner } from "@/components/shop/CookieBanner";
import { Toaster } from "sonner";

const share = Share({ subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: {
    default: "VBK Shoppen",
    template: "%s | VBK Shoppen",
  },
  description:
    "Officiel merchandise-butik for Vorbasse Boldklub. Køb trøjer, træningsudstyr og bliv fanklubsmedlem.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da" className={share.className}>
      <body>
        <Providers>
          <Header />
          <SportsTicker />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CookieBanner />
        </Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
