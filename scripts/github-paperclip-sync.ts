/**
 * GitHub <-> Paperclip bidirectional sync — agent procedure
 *
 * This file is NOT executed via ts-node. It is the authoritative sync procedure
 * read and executed by the CTO agent (9a615f60) on each routine heartbeat.
 *
 * GitHub operations: use GitHub MCP tools (mcp__github__*)
 * Paperclip operations: use Paperclip HTTP API (pcFetch helpers below)
 *
 * Execution order:
 *   1. Fetch all GH issues (open + closed) via MCP: mcp__github__list_issues
 *   2. Fetch all PC issues in project via pcFetch (getPCIssues)
 *   3. Build pcByGH map: GH issue number → best-match PC task (prefer non-cancelled)
 *   4. Inbound loop (GH → PC):
 *      a. Open GH, no PC task   → createPCIssue
 *      b. Open GH, has PC task  → check new GH comments via mcp__github__issue_read (get_comments)
 *                                  post summary to PC task; re-open PC task if keyword found
 *      c. Closed GH, PC task not done/cancelled → mark PC task done
 *   5. Outbound loop (PC → GH):
 *      PC task done/cancelled, linked GH issue still open
 *        → post Danish close comment via mcp__github__add_issue_comment
 *        → close GH issue via mcp__github__issue_write (state: closed)
 *   6. Post sync summary as comment on the execution issue (VBK-418-equivalent)
 *
 * Comment deduplication: before posting a GH comment to PC, check existing PC
 * comments for the same GH comment id (stored as "GH comment id: N" in body).
 * Before closing a GH issue outbound, check if it is already closed.
 */

// ── Config ───────────────────────────────────────────────────────────────────

const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY ?? "";
const PAPERCLIP_API_URL =
  process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_COMPANY_ID =
  process.env.PAPERCLIP_COMPANY_ID ?? "bea2bf94-3ad0-47d9-ad66-15110e0c24d9";
const PAPERCLIP_RUN_ID = process.env.PAPERCLIP_RUN_ID ?? "";

export const GH_OWNER = "jollejonas";
export const GH_REPO = "vorbasseb";

export const CTO_AGENT_ID = "9a615f60-c40c-4807-a201-212724be20b7";
export const PROJECT_ID = "2dce7dcd-1a41-4740-a1d2-a67bde8ce16f";
export const GOAL_ID = "c3f45c5e-4691-4f24-ba11-9385cf3c4e5d";
export const PARENT_ID = "4977185f-2413-4e98-b2cb-bef7923372ba";

export const REOPEN_KEYWORDS = ["change", "update", "fix", "ret", "opdater"];

// ── Paperclip HTTP helpers ────────────────────────────────────────────────────

async function pcFetch(
  path: string,
  opts: RequestInit = {},
  mutating = false
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${PAPERCLIP_API_KEY}`,
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (mutating && PAPERCLIP_RUN_ID) {
    headers["X-Paperclip-Run-Id"] = PAPERCLIP_RUN_ID;
  }
  const res = await fetch(`${PAPERCLIP_API_URL}${path}`, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Paperclip ${path} → ${res.status} ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── Paperclip issue helpers ───────────────────────────────────────────────────

export interface PCIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  originKind?: string;
  originId?: string;
}

export async function getPCIssues(): Promise<PCIssue[]> {
  const res = (await pcFetch(
    `/api/companies/${PAPERCLIP_COMPANY_ID}/issues?projectId=${PROJECT_ID}&limit=200`
  )) as PCIssue[] | { issues: PCIssue[] };
  return Array.isArray(res) ? res : (res.issues ?? []);
}

export function extractGHNumber(title: string): number | null {
  const m = title.match(/\[GH #(\d+)\]/);
  return m ? parseInt(m[1], 10) : null;
}

/** Returns the best PC task for a given GH number: prefer done > in_progress > todo over cancelled. */
export function bestPCIssue(candidates: PCIssue[]): PCIssue | undefined {
  const order = ["done", "in_progress", "in_review", "blocked", "todo", "cancelled"];
  return candidates.sort(
    (a, b) => order.indexOf(a.status) - order.indexOf(b.status)
  )[0];
}

export async function createPCIssue(gh: {
  number: number;
  title: string;
  body: string | null;
}): Promise<PCIssue> {
  const title = `[GH #${gh.number}] ${gh.title}`;
  return (await pcFetch(
    `/api/companies/${PAPERCLIP_COMPANY_ID}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        description: gh.body ?? "",
        status: "todo",
        assigneeAgentId: CTO_AGENT_ID,
        projectId: PROJECT_ID,
        goalId: GOAL_ID,
        parentId: PARENT_ID,
        originKind: "github_issue",
        originId: String(ghIssue.number),
      }),
    },
    true
  )) as PCIssue;
}

export async function commentOnPCIssue(issueId: string, body: string) {
  await pcFetch(
    `/api/issues/${issueId}/comments`,
    { method: "POST", body: JSON.stringify({ body }) },
    true
  );
}

export async function updatePCIssueStatus(
  issueId: string,
  status: string,
  comment: string
) {
  await pcFetch(
    `/api/issues/${issueId}`,
    { method: "PATCH", body: JSON.stringify({ status, comment }) },
    true
  );
}

// ── Danish close comment ──────────────────────────────────────────────────────

export function buildDanishCloseComment(pcTitle: string): string {
  const title = pcTitle.replace(/\[GH #\d+\]\s*/, "");
  return `## Opgave lukket ✅

Hej! Vi har nu afsluttet arbejdet med denne opgave.

**Hvad betyder det for dig som bruger?**
- Forbedringen/rettelsen er implementeret og klar til brug på Vorbasse Boldklubs hjemmeside.

**Hvad blev bygget/ændret?**
- Opgaven "${title}" er blevet gennemført og godkendt af vores team.
- Ændringerne er live og tilgængelige.

**Status**
Opgaven er fuldstændig afsluttet. Tak for din indrapportering — det hjælper os med at gøre klubbens digitale løsninger bedre for alle!

Har du spørgsmål, er du altid velkommen til at åbne en ny sag. 😊

*Venlig hilsen — Vorbasse BK dev-team*`;
}

// ── GitHub operations (agent executes these via MCP) ─────────────────────────
//
// List all issues (open + closed):
//   mcp__github__list_issues({ owner: GH_OWNER, repo: GH_REPO, state: "OPEN", perPage: 100 })
//   mcp__github__list_issues({ owner: GH_OWNER, repo: GH_REPO, state: "CLOSED", perPage: 100 })
//   Paginate via `after: pageInfo.endCursor` while `pageInfo.hasNextPage`.
//
// Get comments for an issue:
//   mcp__github__issue_read({ method: "get_comments", owner: GH_OWNER, repo: GH_REPO, issue_number: N })
//
// Post comment on GH issue:
//   mcp__github__add_issue_comment({ owner: GH_OWNER, repo: GH_REPO, issue_number: N, body: "..." })
//
// Close GH issue:
//   mcp__github__issue_write({ method: "update", owner: GH_OWNER, repo: GH_REPO, issue_number: N, state: "closed" })
//
// ─────────────────────────────────────────────────────────────────────────────
