import { prisma } from "@/lib/prisma";
import { SportsTickerClient } from "./SportsTickerClient";

const TICKER_KEYS = [
  "ticker_herrer_result",
  "ticker_herrer_next",
  "ticker_damer_result",
  "ticker_damer_next",
  "ticker_herrer2_result",
  "ticker_herrer2_next",
];

export async function SportsTicker() {
  const rows = await prisma.siteSetting
    .findMany({ where: { key: { in: TICKER_KEYS } } })
    .catch(() => []);

  const get = (key: string) =>
    rows.find((r) => r.key === key)?.value?.trim() ?? "";

  const teams = [
    {
      label: "Herrer",
      result: get("ticker_herrer_result"),
      next: get("ticker_herrer_next"),
    },
    {
      label: "Damer",
      result: get("ticker_damer_result"),
      next: get("ticker_damer_next"),
    },
    {
      label: "Herrer 2",
      result: get("ticker_herrer2_result"),
      next: get("ticker_herrer2_next"),
    },
  ].filter((t) => t.result || t.next);

  if (teams.length === 0) return null;
  return <SportsTickerClient teams={teams} />;
}
