import type { Metadata } from "next";
import { Share } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
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
          {children}
        </Providers>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
