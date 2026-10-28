import { notFound } from "next/navigation";
import { FANCLUB_ENABLED } from "@/lib/features";

export default function FanclubLayout({ children }: { children: React.ReactNode }) {
  if (!FANCLUB_ENABLED) notFound();
  return children;
}
