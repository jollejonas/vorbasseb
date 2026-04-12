const BASE = "https://clubservice.dbu.dk/api";

function key() {
  const k = process.env.DBU_API_KEY;
  if (!k) throw new Error("DBU_API_KEY is not set");
  return k;
}

// ── Response types ──────────────────────────────────────────────────────────

export type DbuTeamResponse = {
  TeamId: number;
  TeamName: string | null;
  DivisionName: string;
  Pool: {
    PoolId: number;
    PoolName: string;
    RowName: string;
    ShowResult: boolean | null;
    ShowProgram: boolean | null;
  };
}[];

export type DbuMatchResponse = {
  MatchList: {
    Id: number;
    MatchDateTime: string;
    RoundNo: number;
    HomeTeamName: string;
    HomeTeamScore: number | null;
    AwayTeamName: string;
    AwayTeamScore: number | null;
    StadiumName: string;
  }[];
  Pool: { PoolId: number; PoolName: string; RowName: string };
};

export type DbuStandingResponse = {
  TeamPositionList: {
    TeamId: number;
    TeamName: string;
    IsClubTeam: boolean;
    Sort: number;
    NoOfMatch: number;
    MatchWon: number;
    MatchDrawn: number;
    MatchLost: number;
    ScoreAgainst: number;
    Point: number;
    Score: number;
  }[];
  Pool: { PoolId: number; PoolName: string; RowName: string };
};

// ── Fetch helpers ───────────────────────────────────────────────────────────

async function dbuFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`DBU API error ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export function dbuGetTeams(): Promise<DbuTeamResponse> {
  return dbuFetch<DbuTeamResponse>(`/Team?APIKey=${key()}`);
}

export function dbuGetMatches(poolId: number, teamId: number): Promise<DbuMatchResponse> {
  return dbuFetch<DbuMatchResponse>(
    `/TeamMatch?APIKey=${key()}&PoolId=${poolId}&TeamId=${teamId}`
  );
}

export function dbuGetStandings(poolId: number, teamId: number): Promise<DbuStandingResponse> {
  return dbuFetch<DbuStandingResponse>(
    `/TeamPoolPosition?APIKey=${key()}&PoolId=${poolId}&TeamId=${teamId}`
  );
}

// ── DateTime helper ─────────────────────────────────────────────────────────
// DBU API returns MatchDateTime as a local Danish time string without any
// timezone designator (e.g. "2026-04-10T20:00:00"). If we do new Date(str)
// on a UTC server it is stored as 20:00 UTC, which renders as 22:00 CEST in
// the browser — the classic +2-hour bug. This function correctly interprets
// the string as Europe/Copenhagen local time and returns the true UTC Date.
export function parseDbuDateTime(localStr: string): Date {
  // Step 1: treat the string as if it were UTC to get a rough reference point.
  const approxUtc = new Date(localStr + "Z");

  // Step 2: find out what Copenhagen wall-clock time corresponds to that UTC
  //         moment (sv-SE gives a stable "YYYY-MM-DD HH:mm:ss" string).
  const copenhagenStr = approxUtc.toLocaleString("sv-SE", {
    timeZone: "Europe/Copenhagen",
  });

  // Step 3: parse that Copenhagen string back as if it were UTC to get the
  //         numeric value of the Copenhagen wall-clock time.
  const copenhagenAsUtc = new Date(copenhagenStr.replace(" ", "T") + "Z");

  // Step 4: offset = Copenhagen wall-clock − approxUtc (e.g. +7200000 ms in CEST).
  const offsetMs = copenhagenAsUtc.getTime() - approxUtc.getTime();

  // Step 5: subtract the offset from the approx UTC to get the true UTC instant.
  return new Date(approxUtc.getTime() - offsetMs);
}

// ── Label helper ────────────────────────────────────────────────────────────
// Derives a short display label from the DBU RowName, e.g.:
// "Herrer Serie 4 - Forår 2026" → "Herrer"
// "Herre Serie 3/4 TT"          → "Herrer 2" (falls back to rowName prefix)
export function deriveLabel(rowName: string): string {
  const lower = rowName.toLowerCase();
  if (lower.startsWith("dame")) return "Damer";
  if (lower.startsWith("herr")) return "Herrer";
  // Fallback: first word, title-cased
  return rowName.split(" ")[0];
}
