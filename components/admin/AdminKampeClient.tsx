"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ClubMatch, FootballTeam } from "@prisma/client";

type MatchWithTeams = ClubMatch & {
  homeTeam: FootballTeam | null;
  awayTeam: FootballTeam | null;
};

type Props = {
  matches: MatchWithTeams[];
  teams: FootballTeam[];
};

const CLUB_TEAMS = [
  { key: "Herrer", label: "Herrer" },
  { key: "Damer", label: "Damer" },
  { key: "Herrer2", label: "Herrer 2" },
];

type MatchForm = {
  id?: string;
  league: string;
  matchDate: string;
  homeTeamId: string;
  homeScore: string;
  awayTeamId: string;
  awayScore: string;
  venue: string;
  enabled: boolean;
};

function emptyForm(): MatchForm {
  return {
    league: "",
    matchDate: "",
    homeTeamId: "",
    homeScore: "",
    awayTeamId: "",
    awayScore: "",
    venue: "",
    enabled: true,
  };
}

function matchToForm(m: MatchWithTeams): MatchForm {
  return {
    id: m.id,
    league: m.league,
    matchDate: m.matchDate ? new Date(m.matchDate).toISOString().slice(0, 16) : "",
    homeTeamId: m.homeTeamId ?? "",
    homeScore: m.homeScore != null ? String(m.homeScore) : "",
    awayTeamId: m.awayTeamId ?? "",
    awayScore: m.awayScore != null ? String(m.awayScore) : "",
    venue: m.venue,
    enabled: m.enabled,
  };
}

function MatchFormPanel({
  clubTeam,
  isUpcoming,
  form,
  teams,
  saving,
  onFormChange,
  onSave,
  onDelete,
}: {
  clubTeam: string;
  isUpcoming: boolean;
  form: MatchForm;
  teams: FootballTeam[];
  saving: boolean;
  onFormChange: (f: MatchForm) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const label = isUpcoming ? "Næste kamp" : "Seneste resultat";

  function handleTeamSelect(field: "homeTeamId" | "awayTeamId", teamId: string) {
    const team = teams.find((t) => t.id === teamId);
    const updates: Partial<MatchForm> = { [field]: teamId };
    // Auto-fill venue from selected team's defaultVenue when venue is empty
    if (team?.defaultVenue && !form.venue) {
      updates.venue = team.defaultVenue;
    }
    onFormChange({ ...form, ...updates });
  }

  return (
    <div className="border rounded-xl p-4 bg-white space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-gray-700">{label}</h3>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => onFormChange({ ...form, enabled: e.target.checked })}
            className="w-4 h-4 accent-secondary"
          />
          <span className="text-xs text-gray-600">Vis i ticker</span>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Liga</label>
          <input
            type="text"
            value={form.league}
            onChange={(e) => onFormChange({ ...form, league: e.target.value })}
            placeholder="Serie 4"
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tidspunkt</label>
          <input
            type="datetime-local"
            value={form.matchDate}
            onChange={(e) => onFormChange({ ...form, matchDate: e.target.value })}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Hjemmehold</label>
          <select
            value={form.homeTeamId}
            onChange={(e) => handleTeamSelect("homeTeamId", e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">— Vælg hold —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Udehold</label>
          <select
            value={form.awayTeamId}
            onChange={(e) => handleTeamSelect("awayTeamId", e.target.value)}
            className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          >
            <option value="">— Vælg hold —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!isUpcoming && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hjemmemål</label>
            <input
              type="number"
              min={0}
              value={form.homeScore}
              onChange={(e) => onFormChange({ ...form, homeScore: e.target.value })}
              placeholder="2"
              className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Udemål</label>
            <input
              type="number"
              min={0}
              value={form.awayScore}
              onChange={(e) => onFormChange({ ...form, awayScore: e.target.value })}
              placeholder="1"
              className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Spillested</label>
        <input
          type="text"
          value={form.venue}
          onChange={(e) => onFormChange({ ...form, venue: e.target.value })}
          placeholder="Vorbasse Stadion"
          className="w-full border rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-primary text-secondary font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
        >
          {saving ? "Gemmer..." : "Gem"}
        </button>
        {form.id && (
          <button
            onClick={onDelete}
            className="px-4 py-1.5 rounded-lg border border-red-200 text-red-500 text-sm hover:border-red-400 transition"
          >
            Slet
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminKampeClient({ matches: initialMatches, teams: initialTeams }: Props) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [teams, setTeams] = useState(initialTeams);

  // Per-slot form state: key = "Herrer-true" | "Herrer-false" etc.
  const [forms, setForms] = useState<Record<string, MatchForm>>(() => {
    const init: Record<string, MatchForm> = {};
    for (const ct of CLUB_TEAMS) {
      for (const isUpcoming of [true, false]) {
        const key = `${ct.key}-${isUpcoming}`;
        const existing = initialMatches.find(
          (m) => m.clubTeam === ct.key && m.isUpcoming === isUpcoming
        );
        init[key] = existing ? matchToForm(existing) : emptyForm();
      }
    }
    return init;
  });

  const [saving, setSaving] = useState<Record<string, boolean>>({});

  function updateForm(key: string, f: MatchForm) {
    setForms((prev) => ({ ...prev, [key]: f }));
  }

  async function handleSave(clubTeam: string, isUpcoming: boolean) {
    const key = `${clubTeam}-${isUpcoming}`;
    const form = forms[key];
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      const payload = {
        clubTeam,
        isUpcoming,
        league: form.league,
        matchDate: form.matchDate || null,
        homeTeamId: form.homeTeamId || null,
        homeScore: form.homeScore !== "" ? Number(form.homeScore) : null,
        awayTeamId: form.awayTeamId || null,
        awayScore: form.awayScore !== "" ? Number(form.awayScore) : null,
        venue: form.venue,
        enabled: form.enabled,
      };

      let res: Response;
      if (form.id) {
        res = await fetch(`/api/matches/${form.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error();
      const updated: MatchWithTeams = await res.json();
      setForms((prev) => ({ ...prev, [key]: matchToForm(updated) }));
      setMatches((prev) => {
        const existing = prev.findIndex((m) => m.id === updated.id);
        if (existing >= 0) return prev.map((m) => (m.id === updated.id ? updated : m));
        return [...prev, updated];
      });
      toast.success("Gemt");
      router.refresh();
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  async function handleDelete(clubTeam: string, isUpcoming: boolean) {
    const key = `${clubTeam}-${isUpcoming}`;
    const form = forms[key];
    if (!form.id) return;
    if (!confirm("Slet denne kamp fra tickeren?")) return;
    try {
      const res = await fetch(`/api/matches/${form.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setForms((prev) => ({ ...prev, [key]: emptyForm() }));
      setMatches((prev) => prev.filter((m) => m.id !== form.id));
      toast.success("Slettet");
      router.refresh();
    } catch {
      toast.error("Noget gik galt");
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
      setTeams((prev) =>
        prev.map((t) => (t.id === id ? updated : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingTeamId(null);
      toast.success("Hold opdateret");
    } catch {
      toast.error("Noget gik galt");
    }
  }

  async function handleDeleteTeam(id: string) {
    if (!confirm("Slet dette hold? Eksisterende kampe mister holdreference.")) return;
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
      {/* ── Per-team match sections ─────────────────────────────────────────── */}
      {CLUB_TEAMS.map((ct) => (
        <section key={ct.key}>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="bg-primary text-secondary text-xs font-black px-2 py-0.5 rounded">
              {ct.label.toUpperCase()}
            </span>
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[true, false].map((isUpcoming) => (
              <MatchFormPanel
                key={`${ct.key}-${isUpcoming}`}
                clubTeam={ct.key}
                isUpcoming={isUpcoming}
                form={forms[`${ct.key}-${isUpcoming}`]}
                teams={teams}
                saving={saving[`${ct.key}-${isUpcoming}`] ?? false}
                onFormChange={(f) => updateForm(`${ct.key}-${isUpcoming}`, f)}
                onSave={() => handleSave(ct.key, isUpcoming)}
                onDelete={() => handleDelete(ct.key, isUpcoming)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* ── Team registry ───────────────────────────────────────────────────── */}
      <section>
        <button
          onClick={() => setShowTeams((v) => !v)}
          className="flex items-center gap-2 text-lg font-bold mb-3 hover:text-secondary transition"
        >
          {showTeams ? "▼" : "▶"} Holdregister ({teams.length} hold)
        </button>

        {showTeams && (
          <div className="space-y-4">
            {/* Team table */}
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
                              <input
                                value={editTeamForm.name}
                                onChange={(e) =>
                                  setEditTeamForm((f) => ({ ...f, name: e.target.value }))
                                }
                                className={inputCls}
                              />
                            </td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              <input
                                value={editTeamForm.logo}
                                onChange={(e) =>
                                  setEditTeamForm((f) => ({ ...f, logo: e.target.value }))
                                }
                                placeholder="https://..."
                                className={inputCls}
                              />
                            </td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              <input
                                value={editTeamForm.defaultVenue}
                                onChange={(e) =>
                                  setEditTeamForm((f) => ({ ...f, defaultVenue: e.target.value }))
                                }
                                className={inputCls}
                              />
                            </td>
                            <td className="px-4 py-2 flex gap-2 justify-end">
                              <button
                                onClick={() => handleSaveTeam(team.id)}
                                className="text-xs font-semibold text-secondary underline"
                              >
                                Gem
                              </button>
                              <button
                                onClick={() => setEditingTeamId(null)}
                                className="text-xs text-gray-400"
                              >
                                Annuller
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-2 font-medium">{team.name}</td>
                            <td className="px-4 py-2 hidden md:table-cell">
                              {team.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={team.logo}
                                  alt={team.name}
                                  className="w-6 h-6 rounded-full object-cover"
                                />
                              ) : (
                                <span className="text-gray-300 text-xs">Ingen</span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-gray-500 hidden md:table-cell">
                              {team.defaultVenue || "—"}
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex gap-3 justify-end">
                                <button
                                  onClick={() => {
                                    setEditingTeamId(team.id);
                                    setEditTeamForm({
                                      name: team.name,
                                      logo: team.logo ?? "",
                                      defaultVenue: team.defaultVenue ?? "",
                                    });
                                  }}
                                  className="text-xs text-secondary underline"
                                >
                                  Rediger
                                </button>
                                <button
                                  onClick={() => handleDeleteTeam(team.id)}
                                  className="text-xs text-red-400 underline"
                                >
                                  Slet
                                </button>
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

            {/* Add new team form */}
            <div className="border rounded-xl p-4 bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-700">+ Tilføj nyt hold</p>
              <div className="grid md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Holdnavn *</label>
                  <input
                    type="text"
                    value={teamForm.name}
                    onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Læborg GF"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Logo URL</label>
                  <input
                    type="text"
                    value={teamForm.logo}
                    onChange={(e) => setTeamForm((f) => ({ ...f, logo: e.target.value }))}
                    placeholder="https://..."
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Standard spillested
                  </label>
                  <input
                    type="text"
                    value={teamForm.defaultVenue}
                    onChange={(e) => setTeamForm((f) => ({ ...f, defaultVenue: e.target.value }))}
                    placeholder="Stadionnavn"
                    className={inputCls}
                  />
                </div>
              </div>
              <button
                onClick={handleAddTeam}
                disabled={addingTeam || !teamForm.name.trim()}
                className="bg-primary text-secondary font-bold px-4 py-1.5 rounded-lg text-sm hover:bg-primary-dark transition disabled:opacity-50"
              >
                {addingTeam ? "Tilføjer..." : "Tilføj hold"}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
