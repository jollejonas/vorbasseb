// @ts-check
/**
 * GitHub <-> Paperclip bidirectional sync script
 * Usage: npm run sync-github
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────

const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? "";
const PAPERCLIP_API_KEY = process.env.PAPERCLIP_API_KEY ?? "";
const PAPERCLIP_API_URL =
  process.env.PAPERCLIP_API_URL ?? "http://127.0.0.1:3100";
const PAPERCLIP_COMPANY_ID =
  process.env.PAPERCLIP_COMPANY_ID ?? "bea2bf94-3ad0-47d9-ad66-15110e0c24d9";
const PAPERCLIP_RUN_ID = process.env.PAPERCLIP_RUN_ID ?? "";

const GH_REPO = "jollejonas/vorbasseb";
const GH_API = "https://api.github.com";

// Fixed ids from spec
const CTO_AGENT_ID = "9a615f60-c40c-4807-a201-212724be20b7";
const PROJECT_ID = "2dce7dcd-1a41-4740-a1d2-a67bde8ce16f";
const GOAL_ID = "c3f45c5e-4691-4f24-ba11-9385cf3c4e5d";
const PARENT_ID = "4977185f-2413-4e98-b2cb-bef7923372ba";

const STATE_FILE = path.join(__dirname, "github-sync-state.json");

const REOPEN_KEYWORDS = ["change", "update", "fix", "ret", "opdater"];

// ── State ────────────────────────────────────────────────────────────────────

interface SyncState {
  lastSyncAt: string;
  lastSeenCommentIds: Record<number, number>; // ghIssueNumber -> last seen GH comment id
}

function loadState(): SyncState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { lastSyncAt: new Date(0).toISOString(), lastSeenCommentIds: {} };
  }
}

function saveState(state: SyncState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────

async function ghFetch(path: string, opts: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${GH_API}${path}`, {
    ...opts,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(opts.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub ${path} → ${res.status} ${await res.text()}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

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
  const res = await fetch(`${PAPERCLIP_API_URL}${path}`, {
    ...opts,
    headers,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Paperclip ${path} → ${res.status} ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ── GitHub helpers ────────────────────────────────────────────────────────────

interface GHIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  body: string | null;
  updated_at: string;
  html_url: string;
}

interface GHComment {
  id: number;
  body: string;
  created_at: string;
  user: { login: string };
}

async function getGHIssues(): Promise<GHIssue[]> {
  const all: GHIssue[] = [];
  let page = 1;
  while (true) {
    const batch = (await ghFetch(
      `/repos/${GH_REPO}/issues?state=all&per_page=100&page=${page}`
    )) as GHIssue[];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function getGHComments(issueNumber: number): Promise<GHComment[]> {
  return (await ghFetch(
    `/repos/${GH_REPO}/issues/${issueNumber}/comments?per_page=100`
  )) as GHComment[];
}

async function closeGHIssue(issueNumber: number, comment: string) {
  await ghFetch(`/repos/${GH_REPO}/issues/${issueNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: comment }),
  });
  await ghFetch(`/repos/${GH_REPO}/issues/${issueNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
}

// ── Paperclip helpers ─────────────────────────────────────────────────────────

interface PCIssue {
  id: string;
  identifier: string;
  title: string;
  status: string;
  originKind?: string;
  originId?: string;
}

interface PCIssueList {
  issues: PCIssue[];
}

async function getPCIssues(): Promise<PCIssue[]> {
  const res = (await pcFetch(
    `/api/companies/${PAPERCLIP_COMPANY_ID}/issues?projectId=${PROJECT_ID}&limit=200`
  )) as PCIssueList;
  return res.issues ?? [];
}

function extractGHNumber(title: string): number | null {
  const m = title.match(/\[GH #(\d+)\]/);
  return m ? parseInt(m[1], 10) : null;
}

async function createPCIssue(ghIssue: GHIssue): Promise<PCIssue> {
  const title = `[GH #${ghIssue.number}] ${ghIssue.title}`;
  return (await pcFetch(
    `/api/companies/${PAPERCLIP_COMPANY_ID}/issues`,
    {
      method: "POST",
      body: JSON.stringify({
        title,
        description: ghIssue.body ?? "",
        status: "todo",
        assigneeAgentId: CTO_AGENT_ID,
        projectId: PROJECT_ID,
        goalId: GOAL_ID,
        parentId: PARENT_ID,
        originKind: "github",
        originId: String(ghIssue.number),
      }),
    },
    true
  )) as PCIssue;
}

async function commentOnPCIssue(issueId: string, body: string) {
  await pcFetch(
    `/api/issues/${issueId}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
    true
  );
}

async function updatePCIssueStatus(
  issueId: string,
  status: string,
  comment: string
) {
  await pcFetch(
    `/api/issues/${issueId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ status, comment }),
    },
    true
  );
}

// ── Outbound Danish close comment ─────────────────────────────────────────────

function buildDanishCloseComment(pcIssue: PCIssue, ghNumber: number): string {
  const title = pcIssue.title.replace(/\[GH #\d+\]\s*/, "");
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

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!GITHUB_TOKEN) {
    console.error("GITHUB_TOKEN is required");
    process.exit(1);
  }
  if (!PAPERCLIP_API_KEY) {
    console.error("PAPERCLIP_API_KEY is required");
    process.exit(1);
  }

  const state = loadState();

  console.log(`\n🔄 GitHub ↔ Paperclip sync — ${new Date().toISOString()}`);
  console.log(`   Last sync: ${state.lastSyncAt}\n`);

  const [ghIssues, pcIssues] = await Promise.all([
    getGHIssues(),
    getPCIssues(),
  ]);

  // Build lookup maps — primary: originKind/originId; fallback: title pattern for legacy issues
  const pcByGH = new Map<number, PCIssue>();
  for (const pc of pcIssues) {
    if (pc.originKind === "github" && pc.originId) {
      const n = parseInt(pc.originId, 10);
      if (!isNaN(n)) {
        pcByGH.set(n, pc);
        continue;
      }
    }
    // Legacy fallback: issues created before originKind/originId were set
    const n = extractGHNumber(pc.title);
    if (n !== null && !pcByGH.has(n)) pcByGH.set(n, pc);
  }

  const ghByNumber = new Map<number, GHIssue>();
  for (const gh of ghIssues) ghByNumber.set(gh.number, gh);

  let created = 0;
  let commented = 0;
  let closedInbound = 0;
  let closedOutbound = 0;

  // ── Inbound: GH → Paperclip ────────────────────────────────────────────────

  for (const gh of ghIssues) {
    const pcIssue = pcByGH.get(gh.number);

    if (gh.state === "open") {
      if (!pcIssue) {
        // New open GH issue with no matching PC task → create
        try {
          const created_ = await createPCIssue(gh);
          pcByGH.set(gh.number, created_);
          console.log(
            `  ✅ Created PC task ${created_.identifier} for GH #${gh.number}`
          );
          created++;
        } catch (e) {
          console.error(`  ❌ Failed to create PC task for GH #${gh.number}:`, e);
        }
      } else {
        // Existing open GH issue with matching PC task → check for new comments
        let ghComments: GHComment[] = [];
        try {
          ghComments = await getGHComments(gh.number);
        } catch {
          // non-fatal
        }

        const lastSeen = state.lastSeenCommentIds[gh.number] ?? 0;
        const newComments = ghComments.filter((c) => c.id > lastSeen);

        if (newComments.length > 0) {
          const summary = newComments
            .map(
              (c) =>
                `**@${c.user.login}** (${c.created_at.slice(0, 10)}):\n> ${c.body.slice(0, 300)}${c.body.length > 300 ? "…" : ""}`
            )
            .join("\n\n");

          const body = `## GitHub sync: nye kommentarer på GH #${gh.number}\n\n${summary}`;

          try {
            await commentOnPCIssue(pcIssue.id, body);
            commented++;

            // Re-open if done/cancelled and comment has trigger keywords
            const hasKeyword = newComments.some((c) =>
              REOPEN_KEYWORDS.some((kw) => c.body.toLowerCase().includes(kw))
            );
            if (
              hasKeyword &&
              (pcIssue.status === "done" || pcIssue.status === "cancelled")
            ) {
              await updatePCIssueStatus(
                pcIssue.id,
                "todo",
                `GitHub sync: GH #${gh.number} har nye kommentarer med ændringsønsker — genåbnet.`
              );
              console.log(
                `  🔁 Re-opened PC task ${pcIssue.identifier} (keyword in GH comment)`
              );
            }
          } catch (e) {
            console.error(
              `  ❌ Failed to comment on PC task ${pcIssue.identifier}:`,
              e
            );
          }

          // Update last seen
          const maxId = Math.max(...newComments.map((c) => c.id));
          state.lastSeenCommentIds[gh.number] = maxId;
        }
      }
    } else if (gh.state === "closed" && pcIssue) {
      // Closed GH issue with matching PC task not already done/cancelled
      if (pcIssue.status !== "done" && pcIssue.status !== "cancelled") {
        try {
          await updatePCIssueStatus(
            pcIssue.id,
            "done",
            `GitHub sync: GitHub issue #${gh.number} was closed.`
          );
          console.log(
            `  🔒 Closed PC task ${pcIssue.identifier} (GH #${gh.number} closed)`
          );
          closedInbound++;
        } catch (e) {
          console.error(
            `  ❌ Failed to close PC task ${pcIssue.identifier}:`,
            e
          );
        }
      }
    }
  }

  // ── Outbound: Paperclip → GH ───────────────────────────────────────────────

  for (const pc of pcIssues) {
    const ghNumber = extractGHNumber(pc.title);
    if (ghNumber === null) continue;

    if (pc.status !== "done" && pc.status !== "cancelled") continue;

    const gh = ghByNumber.get(ghNumber);
    if (!gh || gh.state !== "open") continue;

    // PC task done/cancelled but GH issue still open → close it
    const danishComment = buildDanishCloseComment(pc, ghNumber);
    try {
      await closeGHIssue(ghNumber, danishComment);
      console.log(
        `  🔒 Closed GH #${ghNumber} (PC task ${pc.identifier} is ${pc.status})`
      );
      closedOutbound++;
    } catch (e) {
      console.error(`  ❌ Failed to close GH #${ghNumber}:`, e);
    }
  }

  // ── Save state & summary ───────────────────────────────────────────────────

  state.lastSyncAt = new Date().toISOString();
  saveState(state);

  console.log(`
📊 Sync complete:
   Created (inbound):         ${created}
   Commented (inbound):       ${commented}
   Closed inbound (GH→PC):   ${closedInbound}
   Closed outbound (PC→GH):  ${closedOutbound}
`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
