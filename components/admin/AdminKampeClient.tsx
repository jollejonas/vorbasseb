"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { DbuTeamConfig, DbuMatch, DbuStanding, FootballTeam } from "@prisma/client";

type ConfigWithData = DbuTeamConfig & {
  matches: DbuMatch[];
  standings: DbuStanding[];
};

type Props = {
  configs: ConfigWithData[];
  teams: FootballTeam[];
};

function formatDt(d: Date | string) {
  return new Intl.DateTimeFormat("da-DK", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(d));
}

function MatchRow({ m }: { m: DbuMatch }) {
  const played = m.homeScore != null;
  return (
    <tr className="border-t text-xs">
      <td className="px-3 py-1.5 text-gray-400">{m.roundNo}</td>
      <td className="px-3 py-1.5 text-gray-500">{formatDt(m.matchDateTime)}</td>
      <td className="px-3 py-1.5 font-medium">{m.homeTeamName}</td>
      <td className="px-3 py-1.5 text-center font-bold text-secondary">
        {played ? `${m.homeScore}–${m.awayScore}` : "vs"}
      </td>
      <td className="px-3 py-1.5 font-medium">{m.awayTeamName}</td>
      <td className="px-3 py-1.5 text-gray-400 hidden md:table-cell">{m.stadiumName}</td>
    </tr>
  );
}

function StandingsTable({ rows }: { rows: DbuStanding[] }) {
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-3 py-1.5 text-left text-gray-500 font-medium">#</th>
          <th className="px-3 py-1.5 text-left text-gray-500 font-medium">Hold</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">K</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">V</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">U</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">T</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">M</th>
          <th className="px-3 py-1.5 text-center text-gray-500 font-medium">P</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.sort}
            className={`border-t ${r.isClubTeam ? "bg-primary/10 font-semibold" : ""}`}
          >
            <td className="px-3 py-1.5">{r.sort}</td>
            <td className="px-3 py-1.5">{r.teamName}</td>
            <td className="px-3 py-1.5 text-center">{r.noOfMatch}</td>
            <td className="px-3 py-1.5 text-center">{r.matchWon}</td>
            <td className="px-3 py-1.5 text-center">{r.matchDrawn}</td>
            <td className="px-3 py-1.5 text-center">{r.matchLost}</td>
            <td className="px-3 py-1.5 text-center">{r.score}–{r.scoreAgainst}</td>
            <td className="px-3 py-1.5 text-center font-bold">{r.point}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AdminKampeClient({ configs: initialConfigs, teams: initialTeams }: Props) {
  const router = useRouter();
  const [configs, setConfigs] = useState(initialConfigs);
  const [teams, setTeams] = useState(initialTeams);
  const [discovering, setDiscovering] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editLabels, setEditLabels] = useState<Record<string, string>>({});
  const [savingLabel, setSavingLabel] = useState<string | null>(null);

  // ── Step 1: Discover teams ─────────────────────────────────────────────────
  async function handleDiscover() {
    setDiscovering(true);
    try {
      const res = await fetch("/api/dbu-sync?step=discover", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fejl");
      const data = await res.json();
      toast.success(`${data.discovered} hold fundet fra DBU`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setDiscovering(false);
    }
  }

  // ── Step 2: Sync match + standings data ────────────────────────────────────
  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/dbu-sync?step=data", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Fejl");
      const data = await res.json();
      toast.success(`Synkroniseret ${data.synced} hold`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSyncing(false);
    }
  }

  // ── Toggle enabled ─────────────────────────────────────────────────────────
  async function handleToggle(config: ConfigWithData) {
    try {
      const res = await fetch(`/api/dbu-team-configs/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !config.enabled }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, ...updated } : c)));
      toast.success(updated.enabled ? "Hold aktiveret" : "Hold deaktiveret");
    } catch {
      toast.error("Noget gik galt");
    }
  }

  // ── Save label ─────────────────────────────────────────────────────────────
  async function handleSaveLabel(config: ConfigWithData) {
    const label = editLabels[config.id];
    if (!label?.trim() || label === config.label) {
      setEditLabels((p) => { const n = { ...p }; delete n[config.id]; return n; });
      return;
    }
    setSavingLabel(config.id);
    try {
      const res = await fetch(`/api/dbu-team-configs/${config.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: label.trim() }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setConfigs((prev) => prev.map((c) => (c.id === config.id ? { ...c, ...updated } : c)));
      setEditLabels((p) => { const n = { ...p }; delete n[config.id]; return n; });
      toast.success("Label gemt");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSavingLabel(null);
    }
  }

  // ── Team registry ──────────────────────────────────────────────────────────
  const [showTeams, setShowTeams] = useState(false);
  const [teamForm, setTeamForm] = useState({ name: "", logo: "", defaultVenue: "" });
  const [addingTeam, setAddingTeam] = useState(false);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editTeamForm, setEditTeamForm] = useState({ name: "", logo: "", defaultVenue: "" });

  async function handleAddTeam() {
    if (!teamForm.name.trim()) return;
    setAddingTeam(true);
    try {
      const res = await fetch("/api/football-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm),
      });
      if (!res.ok) throw new Error();
      const created: FootballTeam = await res.json();
      setTeams((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setTeamForm({ name: "", logo: "", defaultVenue: "" });
      toast.success("Hold tilføjet");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setAddingTeam(false);
    }
  }

  async function handleSaveTeam(id: string) {
    try {
      const res = await fetch(`/api/football-teams/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editTeamForm),
      });
      if (!res.ok) throw new Error();
      const updated: FootballTeam = await res.json();
      setTeams((prev) => prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name)));
      setEditingTeamId(null);
      toast.success("Hold opdateret");
    } catch {
      toast.error("Noget gik galt");
    }
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("Slet dette hold?")) return;
    try {
      const res = await fetch(`/api/football-teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTeams((prev) => prev.filter((t) => t.id !== id));
      toast.success("Hold slettet");
    } catch {
      toast.error("Noget gik galt");
    }
  }

  const inputCls = "w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary";

  return (
    <div className="space-y-10">

      {/* ── Step 1: Discover teams ─────────────────────────────────────────── */}
      <section className="border rounded-xl p-5 bg-white space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold">Hold fra DBU</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Hent klubbens hold fra DBU og vælg hvilke der skal vises i tickeren.
            </p>
          </div>
          <button
            onClick={handleDiscover}
            disabled={discovering}
            className="bg-secondary text-white font-bold px-4 py-2 rounded-xl text-sm hover:bg-secondary-dark transition disabled:opacity-50"
          >
            {discovering ? "Henter..." : "Hent hold fra DBU"}
          </button>
        </div>

        {configs.length === 0 ? (
          <p className="text-sm text-gray-400 italic">
            Klik &quot;Hent hold fra DBU&quot; for at opdage klubbens hold.
          </p>
        ) : (
          <div className="space-y-2">
            {configs.map((config) => {
              const labelValue = editLabels[config.id] ?? config.label;
              const now = new Date();
              const nextMatch = config.matches
                .filter((m) => m.homeScore == null && new Date(m.matchDateTime) > now)
                .sort((a, b) => new Date(a.matchDateTime).getTime() - new Date(b.matchDateTime).getTime())[0];
              const lastResult = config.matches
                .filter((m) => m.homeScore != null)
                .sort((a, b) => new Date(b.matchDateTime).getTime() - new Date(a.matchDateTime).getTime())[0];

              return (
                <div key={config.id} className="border rounded-lg overflow-hidden">
                  {/* Team row */}
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 flex-wrap">
                    {/* Enabled toggle */}
                    <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={() => handleToggle(config)}
                        className="w-4 h-4 accent-secondary"
                      />
                      <span className="text-xs text-gray-600">Aktiv</span>
                    </label>

                    {/* Label (editable) */}
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        value={labelValue}
                        onChange={(e) =>
                          setEditLabels((p) => ({ ...p, [config.id]: e.target.value }))
                        }
                        onBlur={() => handleSaveLabel(config)}
                        onKeyDown={(e) => e.key === "Enter" && handleSaveLabel(config)}
                        className="border rounded px-2 py-0.5 text-sm font-semibold w-28 focus:outline-none focus:ring-1 focus:ring-secondary"
                        placeholder="Label"
                        disabled={savingLabel === config.id}
                      />
                    </div>

                    {/* DBU pool name */}
                    <span className="text-xs text-gray-400 flex-1 min-w-0 truncate">
                      {config.rowName}
                    </span>

                    {/* Last sync */}
                    {config.lastSyncAt && (
                      <span className="text-xs text-gray-400 shrink-0">
                        Synk: {formatDt(config.lastSyncAt)}
                      </span>
                    )}

                    {/* Expand */}
                    <button
                      onClick={() => setExpanded((e) => (e === config.id ? null : config.id))}
                      className="text-xs text-secondary underline shrink-0"
                    >
                      {expanded === config.id ? "Skjul" : "Vis data"}
                    </button>
                  </div>

                  {/* Quick preview */}
                  {(lastResult || nextMatch) && expanded !== config.id && (
                    <div className="flex flex-wrap gap-4 px-4 py-2 text-xs text-gray-600 bg-white border-t">
                      {lastResult && (
                        <span>
                          ⚽ <span className="font-medium">{lastResult.homeTeamName} {lastResult.homeScore}–{lastResult.awayScore} {lastResult.awayTeamName}</span>
                        </span>
                      )}
                      {nextMatch && (
                        <span>
                          📅 <span className="font-medium">{formatDt(nextMatch.matchDateTime)} · {nextMatch.homeTeamName} vs {nextMatch.awayTeamName}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Expanded: matches + standings */}
                  {expanded === config.id && (
                    <div className="border-t divide-y">
                      {config.matches.length > 0 && (
                        <div className="overflow-x-auto">
                          <p className="text-xs font-semibold text-gray-500 px-4 pt-3 pb-1">Kampe</p>
                          <table className="w-full">
                            <thead className="bg-gray-50 text-xs text-gray-500">
                              <tr>
                                <th className="px-3 py-1.5 text-left">Runde</th>
                                <th className="px-3 py-1.5 text-left">Tidspunkt</th>
                                <th className="px-3 py-1.5 text-left">Hjemme</th>
                                <th className="px-3 py-1.5 text-center">Res.</th>
                                <th className="px-3 py-1.5 text-left">Ude</th>
                                <th className="px-3 py-1.5 text-left hidden md:table-cell">Bane</th>
                              </tr>
                            </thead>
                            <tbody>
                              {config.matches
                                .sort((a, b) => new Date(a.matchDateTime).getTime() - new Date(b.matchDateTime).getTime())
                                .map((m) => <MatchRow key={m.id} m={m} />)}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {config.standings.length > 0 && (
                        <div className="overflow-x-auto">
                          <p className="text-xs font-semibold text-gray-500 px-4 pt-3 pb-1">Stilling</p>
                          <StandingsTable rows={config.standings} />
                        </div>
                      )}
                      {config.matches.length === 0 && config.standings.length === 0 && (
                        <p className="text-sm text-gray-400 italic px-4 py-3">
                          Ingen data endnu — klik &quot;Synkronisér kampe og stilling&quot;.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Step 2: Sync data ──────────────────────────────────────────────── */}
      <section className="border rounded-xl p-5 bg-white">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-bold">Synkronisér kampe og stilling</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Henter kampprogrammer og stillinger for aktive hold fra DBU.
            </p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing || configs.filter((c) => c.enabled).length === 0}
            className="bg-primary text-secondary font-bold px-4 py-2 rounded-xl text-sm hover:bg-primary-dark transition disabled:opacity-50"
          >
            {syncing ? "Synkroniserer..." : "Synkronisér kampe og stilling"}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Sker automatisk hver 6. time via Vercel cron. Kræver at{" "}
          <code className="bg-gray-100 px-1 rounded">DBU_API_KEY</code> og{" "}
          <code className="bg-gray-100 px-1 rounded">CRON_SECRET</code>{" "}
          er sat som miljøvariabler.
        </p>
      </section>

      {/* ── Team registry (logos) ──────────────────────────────────────────── */}
      <section>
        <button
          onClick={() => setShowTeams((v) => !v)}
          className="flex items-center gap-2 text-lg font-bold mb-3 hover:text-secondary transition"
        >
          {showTeams ? "▼" : "▶"} Holdregister – logoer ({teams.length} hold)
        </button>
        <p className="text-sm text-gray-500 mb-3">
          Paste logo-URL fra DBU eller anden kilde. Hold matches mod kamp-holdnavne for at vise logoer i tickeren.
        </p>

        {showTeams && (
          <div className="space-y-4">
            {teams.length > 0 && (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-semibold text-gray-600">
                    <tr>
                      <th className="text-left px-4 py-2">Hold</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Logo</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Standard spillested</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {teams.map((team) => (
                      <tr key={team.id} className="hover:bg-gray-50">
                        {editingTeamId === team.id ? (
                          <>
                            <td className="px-4 py-2">
                              <input value={editTeamForm.name} onChange={(e) => setEditTeamForm((f) => ({ ...f, name: e.target.value }))} className={inputCls} />
                            </td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              <input value={editTeamForm.logo} onChange={(e) => setEditTeamForm((f) => ({ ...f, logo: e.target.value }))} placeholder="https://..." className={inputCls} />
                            </td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              <input value={editTeamForm.defaultVenue} onChange={(e) => setEditTeamForm((f) => ({ ...f, defaultVenue: e.target.value }))} className={inputCls} />
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => handleSaveTeam(team.id)} className="text-xs font-semibold text-secondary underline">Gem</button>
                                <button onClick={() => setEditingTeamId(null)} className="text-xs text-gray-400">Annuller</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 font-medium">{team.name}</td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              {team.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={team.logo} alt={team.name} className="w-6 h-6 rounded-full object-cover" />
                              ) : (
                                <span className="text-gray-300 text-xs">Ingen</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{team.defaultVenue || "—"}</td>
                            <td className="px-4 py-2">
                              <div className="flex gap-3 justify-end">
                                <button onClick={() => { setEditingTeamId(team.id); setEditTeamForm({ name: team.name, logo: team.logo ?? "", defaultVenue: team.defaultVenue ?? "" }); }} className="text-xs text-secondary underline">Rediger</button>
                                <button onClick={() => handleDeleteTeam(team.id)} className="text-xs text-red-400 underline">Slet</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-700">+ Tilføj nyt hold</p>
              <div className="grid md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Holdnavn *</label>
                  <input type="text" value={teamForm.name} onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))} placeholder="Læborg GF" className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
                  <input type="text" value={teamForm.logo} onChange={(e) => setTeamForm((f) => ({ ...f, logo: e.target.value }))} placeholder="https://..." className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Standard spillested</label>
                  <input type="text" value={teamForm.defaultVenue} onChange={(e) => setTeamForm((f) => ({ ...f, defaultVenue: e.target.value }))} placeholder="Vorbasse Fritidscenter" className={inputCls} />
                </div>
              </div>
              <button onClick={handleAddTeam} disabled={addingTeam || !teamForm.name.trim()} className="bg-primary text-secondary font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50">
                {addingTeam ? "Tilføjer..." : "Tilføj hold"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
