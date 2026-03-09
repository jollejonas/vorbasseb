"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import type { GlobalColor, OptionGroupTemplate, OptionGroupTemplateValue, ProductOptionType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type TemplateValueFull = OptionGroupTemplateValue & { globalColor: GlobalColor | null };
type TemplateFull = OptionGroupTemplate & { values: TemplateValueFull[] };

type ValueDraft = {
  id?: string;
  label: string;
  position: number;
  globalColorId?: string | null;
  globalColorHex?: string | null;
  images: string[];
};

type TemplateDraft = {
  id?: string;
  name: string;
  type: ProductOptionType;
  tags: string[];
  required: boolean;
  fee: string; // kr string
  inputType: string;
  values: ValueDraft[];
};

const OPTION_TYPES: { value: ProductOptionType; label: string }[] = [
  { value: "COLOR", label: "Farve" },
  { value: "SIZE", label: "Størrelse" },
  { value: "TEXT", label: "Tekst" },
  { value: "SELECT", label: "Vælg" },
  { value: "CUSTOM", label: "Brugerdefineret" },
];

const TYPE_LABELS: Record<ProductOptionType, string> = {
  COLOR: "Farve",
  SIZE: "Størrelse",
  TEXT: "Tekst",
  SELECT: "Vælg",
  CUSTOM: "Brugerdefineret",
};

const TYPE_BADGE: Record<ProductOptionType, string> = {
  COLOR: "bg-pink-100 text-pink-700",
  SIZE: "bg-blue-100 text-blue-700",
  TEXT: "bg-yellow-100 text-yellow-700",
  SELECT: "bg-purple-100 text-purple-700",
  CUSTOM: "bg-gray-100 text-gray-700",
};

// Predefined adult + kids sizes for quick-add
const ADULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
const KIDS_SIZES = ["116", "128", "140", "152", "164"];

function emptyDraft(): TemplateDraft {
  return { name: "", type: "SIZE", tags: [], required: false, fee: "", inputType: "text", values: [] };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (trimmed && !tags.includes(trimmed)) onChange([...tags, trimmed]);
    setInput("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 bg-secondary/10 text-secondary text-xs px-2 py-0.5 rounded-full">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
          placeholder="f.eks. Tøj, Sko..."
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <button type="button" onClick={add} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
          Tilføj
        </button>
      </div>
    </div>
  );
}

function ColorValuePicker({
  values,
  globalColors,
  onChange,
}: {
  values: ValueDraft[];
  globalColors: GlobalColor[];
  onChange: (v: ValueDraft[]) => void;
}) {
  const selectedIds = new Set(values.map((v) => v.globalColorId).filter(Boolean));

  function toggle(gc: GlobalColor) {
    if (selectedIds.has(gc.id)) {
      onChange(values.filter((v) => v.globalColorId !== gc.id).map((v, i) => ({ ...v, position: i })));
    } else {
      onChange([...values, {
        label: gc.name,
        position: values.length,
        globalColorId: gc.id,
        globalColorHex: gc.hex,
        images: [],
      }]);
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">Vælg farver fra biblioteket:</p>
      <div className="flex flex-wrap gap-2">
        {globalColors.map((gc) => {
          const selected = selectedIds.has(gc.id);
          return (
            <button
              key={gc.id}
              type="button"
              onClick={() => toggle(gc)}
              title={gc.name}
              className={`w-9 h-9 rounded-full border-2 transition flex items-center justify-center ${
                selected ? "border-secondary scale-110 shadow-md" : "border-gray-200 hover:border-gray-400"
              }`}
              style={{ background: gc.hex }}
            >
              {selected && <Check size={14} className="text-white drop-shadow" />}
            </button>
          );
        })}
      </div>
      {values.length > 0 && (
        <p className="text-xs text-gray-400 mt-2">Valgte: {values.map((v) => v.label).join(", ")}</p>
      )}
    </div>
  );
}

function SizeValueEditor({
  values,
  onChange,
}: {
  values: ValueDraft[];
  onChange: (v: ValueDraft[]) => void;
}) {
  const [manualInput, setManualInput] = useState("");
  const selected = new Set(values.map((v) => v.label));

  function togglePreset(label: string) {
    if (selected.has(label)) {
      const next = values.filter((v) => v.label !== label).map((v, i) => ({ ...v, position: i }));
      onChange(next);
    } else {
      onChange([...values, { label, position: values.length, images: [] }]);
    }
  }

  function addManual() {
    const trimmed = manualInput.trim();
    if (!trimmed || selected.has(trimmed)) { setManualInput(""); return; }
    onChange([...values, { label: trimmed, position: values.length, images: [] }]);
    setManualInput("");
  }

  function removeValue(label: string) {
    onChange(values.filter((v) => v.label !== label).map((v, i) => ({ ...v, position: i })));
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1">Voksenstørrelser:</p>
        <div className="flex flex-wrap gap-1.5">
          {ADULT_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => togglePreset(s)}
              className={`w-12 h-8 rounded-lg border text-sm font-medium transition ${
                selected.has(s) ? "bg-secondary text-white border-secondary" : "border-gray-300 hover:border-secondary text-gray-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Børnestørrelser:</p>
        <div className="flex flex-wrap gap-1.5">
          {KIDS_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => togglePreset(s)}
              className={`w-14 h-8 rounded-lg border text-sm font-medium transition ${
                selected.has(s) ? "bg-secondary text-white border-secondary" : "border-gray-300 hover:border-secondary text-gray-800"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Tilføj manuelt (f.eks. EU 42, One size):</p>
        <div className="flex gap-2">
          <input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(); } }}
            placeholder="EU 42"
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
          <button type="button" onClick={addManual} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
            Tilføj
          </button>
        </div>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span key={v.label} className="flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-1 rounded-lg">
              {v.label}
              <button type="button" onClick={() => removeValue(v.label)} className="hover:text-red-500">
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SelectValueEditor({
  values,
  onChange,
}: {
  values: ValueDraft[];
  onChange: (v: ValueDraft[]) => void;
}) {
  const [input, setInput] = useState("");

  function add() {
    const trimmed = input.trim();
    if (!trimmed || values.some((v) => v.label === trimmed)) { setInput(""); return; }
    onChange([...values, { label: trimmed, position: values.length, images: [] }]);
    setInput("");
  }

  function remove(label: string) {
    onChange(values.filter((v) => v.label !== label).map((v, i) => ({ ...v, position: i })));
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="f.eks. Bomuld"
          className="flex-1 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
        />
        <button type="button" onClick={add} className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg">
          Tilføj
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v.label} className="flex items-center gap-1 bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-lg">
            {v.label}
            <button type="button" onClick={() => remove(v.label)} className="hover:text-red-500">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main editor form ─────────────────────────────────────────────────────────

function TemplateForm({
  draft,
  globalColors,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
}: {
  draft: TemplateDraft;
  globalColors: GlobalColor[];
  onChange: (d: TemplateDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const set = <K extends keyof TemplateDraft>(key: K, val: TemplateDraft[K]) =>
    onChange({ ...draft, [key]: val });

  return (
    <div className="border rounded-xl p-5 bg-white shadow-sm space-y-4">
      {/* Name + type */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Navn</label>
          <input
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="f.eks. Voksen tøjstørrelser"
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select
            value={draft.type}
            onChange={(e) => set("type", e.target.value as ProductOptionType)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-secondary bg-white"
          >
            {OPTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Tags</label>
        <TagInput tags={draft.tags} onChange={(t) => set("tags", t)} />
      </div>

      {/* Required + fee */}
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={draft.required}
            onChange={(e) => set("required", e.target.checked)}
            className="w-4 h-4 accent-secondary"
          />
          Obligatorisk
        </label>

        {(draft.type === "TEXT" || draft.type === "CUSTOM") && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Gebyr (kr):</label>
            <input
              type="number"
              min="0"
              step="1"
              value={draft.fee}
              onChange={(e) => set("fee", e.target.value)}
              placeholder="0"
              className="w-24 border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary"
            />
          </div>
        )}

        {draft.type === "CUSTOM" && (
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Input-type:</label>
            <select
              value={draft.inputType}
              onChange={(e) => set("inputType", e.target.value)}
              className="border rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-secondary"
            >
              <option value="text">Tekst</option>
              <option value="number">Tal</option>
              <option value="checkbox">Afkrydsning</option>
              <option value="dropdown">Dropdown</option>
            </select>
          </div>
        )}
      </div>

      {/* Values */}
      {draft.type === "COLOR" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Farver</label>
          <ColorValuePicker values={draft.values} globalColors={globalColors} onChange={(v) => set("values", v)} />
        </div>
      )}
      {draft.type === "SIZE" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Størrelser</label>
          <SizeValueEditor values={draft.values} onChange={(v) => set("values", v)} />
        </div>
      )}
      {draft.type === "SELECT" && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Valgmuligheder</label>
          <SelectValueEditor values={draft.values} onChange={(v) => set("values", v)} />
        </div>
      )}
      {(draft.type === "TEXT" || draft.type === "CUSTOM") && (
        <p className="text-xs text-gray-400 italic">
          Tekst- og brugerdefinerede grupper har ingen foruddefinerede værdier – kunden skriver selv.
        </p>
      )}

      {/* Buttons */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !draft.name.trim()}
            className="flex items-center gap-2 bg-secondary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-secondary/90 disabled:opacity-50 transition"
          >
            <Check size={15} />
            {saving ? "Gemmer…" : "Gem"}
          </button>
          <button type="button" onClick={onCancel} className="text-sm px-4 py-2 rounded-lg border hover:bg-gray-50 transition">
            Annuller
          </button>
        </div>
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 transition"
          >
            <Trash2 size={14} />
            Slet skabelon
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function OptionTemplateManager({
  initialTemplates,
  globalColors,
}: {
  initialTemplates: TemplateFull[];
  globalColors: GlobalColor[];
}) {
  const [templates, setTemplates] = useState<TemplateFull[]>(initialTemplates);
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null = none, "NEW" = new
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft());
  const [saving, setSaving] = useState(false);

  // Collect all unique tags across templates
  const allTags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => t.tags.forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);

  const templatesByType = useMemo(() => {
    return OPTION_TYPES.map((typeObj) => ({
      ...typeObj,
      templates: templates.filter((t) => {
        if (t.type !== typeObj.value) return false;
        if (filterTag && !t.tags.includes(filterTag)) return false;
        return true;
      }),
    }));
  }, [templates, filterTag]);

  function startNew() {
    setDraft(emptyDraft());
    setEditingId("NEW");
  }

  function startEdit(t: TemplateFull) {
    setDraft({
      id: t.id,
      name: t.name,
      type: t.type,
      tags: t.tags,
      required: t.required,
      fee: t.fee ? String(Math.round(t.fee / 100)) : "",
      inputType: t.inputType ?? "text",
      values: t.values.map((v) => ({
        id: v.id,
        label: v.label,
        position: v.position,
        globalColorId: v.globalColorId,
        globalColorHex: v.globalColor?.hex ?? null,
        images: v.images,
      })),
    });
    setEditingId(t.id);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(emptyDraft());
  }

  async function handleSave() {
    setSaving(true);
    const payload = {
      name: draft.name.trim(),
      type: draft.type,
      tags: draft.tags,
      required: draft.required,
      fee: draft.fee ? Math.round(parseFloat(draft.fee) * 100) : null,
      inputType: draft.inputType || null,
      values: draft.values.map((v, i) => ({
        id: v.id,
        label: v.label,
        position: i,
        globalColorId: v.globalColorId ?? null,
        images: v.images,
      })),
    };

    try {
      if (draft.id) {
        const res = await fetch(`/api/admin/option-templates/${draft.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const updated: TemplateFull = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      } else {
        const res = await fetch("/api/admin/option-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const created: TemplateFull = await res.json();
        setTemplates((prev) => [...prev, created]);
      }
      cancelEdit();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Slet denne skabelon? Det påvirker ikke eksisterende produkter.")) return;
    await fetch(`/api/admin/option-templates/${id}`, { method: "DELETE" });
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    cancelEdit();
  }

  return (
    <div className="space-y-8">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-2">
        {allTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => setFilterTag(filterTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition ${
                  filterTag === tag ? "bg-secondary text-white border-secondary" : "border-gray-300 text-gray-600 hover:border-secondary"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={startNew}
          disabled={editingId !== null}
          className="ml-auto flex items-center gap-1 bg-secondary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-secondary/90 disabled:opacity-40 transition"
        >
          <Plus size={15} />
          Ny skabelon
        </button>
      </div>

      {/* New template form */}
      {editingId === "NEW" && (
        <TemplateForm
          draft={draft}
          globalColors={globalColors}
          onChange={setDraft}
          onSave={handleSave}
          onCancel={cancelEdit}
          saving={saving}
        />
      )}

      {/* Grouped sections by type */}
      {templatesByType.map((group) => (
        <div key={group.value}>
          <div className="flex items-center gap-3 mb-3">
            <h2 className="text-base font-semibold text-gray-800">{group.label}</h2>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[group.value]}`}>
              {group.templates.length}
            </span>
          </div>

          {group.templates.length === 0 ? (
            <p className="text-sm text-gray-400 italic pl-1">Ingen skabeloner endnu.</p>
          ) : (
            <div className="space-y-3">
              {group.templates.map((t) => (
                <div key={t.id}>
                  {editingId === t.id ? (
                    <TemplateForm
                      draft={draft}
                      globalColors={globalColors}
                      onChange={setDraft}
                      onSave={handleSave}
                      onCancel={cancelEdit}
                      onDelete={() => handleDelete(t.id)}
                      saving={saving}
                    />
                  ) : (
                    <div className="flex items-start gap-4 border rounded-xl p-4 bg-white hover:shadow-sm transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{t.name}</span>
                          {t.required && <span className="text-xs text-gray-400">(obligatorisk)</span>}
                        </div>

                        {t.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-2">
                            {t.tags.map((tag) => (
                              <span key={tag} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}

                        {t.values.length > 0 && (
                          <p className="text-xs text-gray-500 truncate">
                            {t.type === "COLOR"
                              ? t.values.map((v) => v.label).join(", ")
                              : t.values.map((v) => v.label).join(" · ")}
                          </p>
                        )}
                        {(t.type === "TEXT" || t.type === "CUSTOM") && (
                          <p className="text-xs text-gray-400 italic">Fritekst-input</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        disabled={editingId !== null}
                        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 disabled:opacity-40 transition shrink-0"
                      >
                        <Pencil size={14} />
                        Rediger
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
