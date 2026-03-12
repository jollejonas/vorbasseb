"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  email: string;
  newsletterConsent: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  birthDate: string | null; // ISO date string YYYY-MM-DD
  addressLine1: string | null;
  addressLine2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
};

async function patchAccount(data: Record<string, string | null>) {
  const res = await fetch("/api/account", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Ukendt fejl");
  }
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-gray-800">
        {value || <em className="text-gray-400">Ikke udfyldt</em>}
      </p>
    </div>
  );
}

function EditActions({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-2 mt-4">
      <button
        type="submit"
        disabled={saving}
        className="bg-secondary text-white text-xs font-semibold px-4 py-1.5 rounded-lg hover:bg-secondary-dark transition disabled:opacity-50"
      >
        {saving ? "Gemmer..." : "Gem"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-xs text-gray-500 hover:text-gray-700 px-2"
      >
        Annuller
      </button>
    </div>
  );
}

function SectionHeader({ title, onEdit }: { title: string; onEdit: () => void }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{title}</p>
      <button
        type="button"
        onClick={onEdit}
        className="text-xs text-secondary underline hover:text-secondary-dark"
      >
        Rediger
      </button>
    </div>
  );
}

export function AccountClient({
  email,
  newsletterConsent: initialConsent,
  firstName: initialFirstName,
  lastName: initialLastName,
  phone: initialPhone,
  birthDate: initialBirthDate,
  addressLine1: initialAddressLine1,
  addressLine2: initialAddressLine2,
  postalCode: initialPostalCode,
  city: initialCity,
  country: initialCountry,
}: Props) {
  // ── Personal info state ───────────────────────────────────────────────────
  const [editingPersonal, setEditingPersonal] = useState(false);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [firstName, setFirstName] = useState(initialFirstName ?? "");
  const [lastName, setLastName] = useState(initialLastName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [birthDate, setBirthDate] = useState(initialBirthDate ?? "");

  // ── Address state ─────────────────────────────────────────────────────────
  const [editingAddress, setEditingAddress] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressLine1, setAddressLine1] = useState(initialAddressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(initialAddressLine2 ?? "");
  const [postalCode, setPostalCode] = useState(initialPostalCode ?? "");
  const [city, setCity] = useState(initialCity ?? "");
  const [country, setCountry] = useState(initialCountry);

  // ── Newsletter state ──────────────────────────────────────────────────────
  const [newsletterConsent, setNewsletterConsent] = useState(initialConsent);
  const [savingNewsletter, setSavingNewsletter] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────
  async function handleSavePersonal(e: React.FormEvent) {
    e.preventDefault();
    setSavingPersonal(true);
    try {
      await patchAccount({ firstName, lastName, phone, birthDate });
      toast.success("Personlige oplysninger opdateret");
      setEditingPersonal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSavingPersonal(false);
    }
  }

  async function handleSaveAddress(e: React.FormEvent) {
    e.preventDefault();
    setSavingAddress(true);
    try {
      await patchAccount({ addressLine1, addressLine2, postalCode, city, country });
      toast.success("Adresse opdateret");
      setEditingAddress(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt");
    } finally {
      setSavingAddress(false);
    }
  }

  async function handleNewsletterToggle() {
    setSavingNewsletter(true);
    const newVal = !newsletterConsent;
    try {
      const res = await fetch("/api/account/newsletter-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newsletterConsent: newVal }),
      });
      if (!res.ok) throw new Error();
      setNewsletterConsent(newVal);
      toast.success(newVal ? "Tilmeldt nyhedsbrev" : "Afmeldt nyhedsbrev");
    } catch {
      toast.error("Noget gik galt");
    } finally {
      setSavingNewsletter(false);
    }
  }

  const inputCls =
    "border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-secondary w-full";
  const hasAddress = addressLine1 || postalCode || city;

  return (
    <div className="space-y-6">

      {/* E-mail */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">E-mail</p>
        <p className="text-sm text-gray-800">{email}</p>
        <p className="text-xs text-gray-400 mt-0.5">Din e-mailadresse kan ikke ændres.</p>
      </div>

      {/* Personlige oplysninger */}
      <div>
        {editingPersonal ? (
          <form onSubmit={handleSavePersonal}>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
              Personlige oplysninger
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fornavn</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={inputCls}
                  placeholder="Fornavn"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Efternavn</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputCls}
                  placeholder="Efternavn"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Mobilnummer</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  placeholder="+45 12 34 56 78"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fødselsdato</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <EditActions saving={savingPersonal} onCancel={() => setEditingPersonal(false)} />
          </form>
        ) : (
          <>
            <SectionHeader title="Personlige oplysninger" onEdit={() => setEditingPersonal(true)} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fornavn" value={firstName} />
              <Field label="Efternavn" value={lastName} />
              <Field label="Mobilnummer" value={phone} />
              <Field
                label="Fødselsdato"
                value={
                  birthDate
                    ? new Intl.DateTimeFormat("da-DK", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(birthDate))
                    : null
                }
              />
            </div>
          </>
        )}
      </div>

      {/* Adresse */}
      <div>
        {editingAddress ? (
          <form onSubmit={handleSaveAddress}>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3">
              Adresse
            </p>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Adresse</label>
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className={inputCls}
                  placeholder="Kirkevej 5"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Adresse linje 2 <span className="text-gray-400">(valgfri)</span>
                </label>
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className={inputCls}
                  placeholder="Lejlighed, etage..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Postnummer</label>
                  <input
                    type="text"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className={inputCls}
                    placeholder="6622"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">By</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className={inputCls}
                    placeholder="Bække"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Land</label>
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className={inputCls}
                  placeholder="DK"
                />
              </div>
            </div>
            <EditActions saving={savingAddress} onCancel={() => setEditingAddress(false)} />
          </form>
        ) : (
          <>
            <SectionHeader title="Adresse" onEdit={() => setEditingAddress(true)} />
            {hasAddress ? (
              <div className="text-sm text-gray-800 space-y-0.5">
                <p>{addressLine1}</p>
                {addressLine2 && <p>{addressLine2}</p>}
                <p>{[postalCode, city].filter(Boolean).join(" ")}</p>
                {country && country !== "DK" && <p>{country}</p>}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">Ingen adresse gemt</p>
            )}
          </>
        )}
      </div>

      {/* Nyhedsbrev */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
          Nyhedsbrev
        </p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={newsletterConsent}
            onChange={handleNewsletterToggle}
            disabled={savingNewsletter}
            className="accent-secondary w-4 h-4"
          />
          <span className="text-sm text-gray-700">
            {newsletterConsent
              ? "Du modtager nyhedsbreve fra VBK Shoppen"
              : "Modtag nyhedsbreve fra VBK Shoppen"}
          </span>
        </label>
      </div>

    </div>
  );
}
