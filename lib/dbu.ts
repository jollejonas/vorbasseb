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
