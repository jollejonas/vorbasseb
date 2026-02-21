import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Header } from "@/components/shop/Header";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Vorbasse Boldklub Shop",
    template: "%s | Vorbasse Boldklub",
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
          <footer className="bg-secondary text-white py-8 mt-16">
            <div className="max-w-6xl mx-auto px-4 text-center">
              <p className="text-sm opacity-80">
                © {new Date().getFullYear()} Vorbasse Boldklub. Alle
                rettigheder forbeholdes.
              </p>
            </div>
          </footer>
        </Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
