import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/shop/Header";
import { Footer } from "@/components/shop/Footer";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

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
    <html lang="da" className={inter.className}>
      <body>
        <Providers>
          <Header />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
