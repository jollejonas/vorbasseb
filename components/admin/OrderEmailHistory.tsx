"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type EmailEntry = {
  id: string; kind: string; automatic: boolean; triggeredBy: string | null;
  from: string; to: string; subject: string; html: string; status: string;
  createdAt: string; sentAt: string | null; error: string | null; providerId: string | null;
};
const statuses: Record<string, string> = {
  ACCEPTED: "Afsendt til mailtjenesten", FAILED: "Afsendelse afvist",
  PENDING: "Afventer bekræftelse", UNKNOWN: "Afsendelse uafklaret",
};
const kinds: Record<string, string> = { CONFIRMATION: "Ordrebekræftelse", SHIPPING: "Forsendelsesbesked", UPDATE: "Manuel opdatering" };
const date = (value: string) => new Intl.DateTimeFormat("da-DK", { dateStyle: "short", timeStyle: "medium", timeZone: "Europe/Copenhagen" }).format(new Date(value));

export function OrderEmailHistory({ orderId, orderNumber, recipient, sender, emails, available = true }: {
  orderId: string; orderNumber: number; recipient: string | null; sender: string; emails: EmailEntry[]; available?: boolean;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState(`Opdatering om ordre #${orderNumber} – Vorbasse Boldklub`);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState("");
  const request = useRef<{ key: string; subject: string; message: string } | null>(null);
  const inFlight = useRef(false);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current || !available) return;
    inFlight.current = true;
    setSending(true);
    setFeedback("");
    if (!request.current || request.current.subject !== subject || request.current.message !== message) {
      request.current = { key: crypto.randomUUID(), subject, message };
    }
    try {
      const response = await fetch(`/api/orders/${orderId}/emails`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, requestKey: request.current.key }),
      });
      const result = await response.json();
      if (response.ok && result.status === "ACCEPTED") {
        setMessage("");
        request.current = null;
        setFeedback("Mailen er afsendt til mailtjenesten og gemt i historikken.");
      } else {
        if (result.status === "FAILED") request.current = null;
        setFeedback(result.error || `${statuses[result.status] || "Afsendelsen kunne ikke bekræftes"}. Se historikken før en ny afsendelse.`);
      }
    } catch {
      setFeedback("Forbindelsen blev afbrudt. Opdatér historikken for at kontrollere afsendelsen. En gentagelse af samme besked sender ikke en ekstra mail.");
    } finally {
      inFlight.current = false;
      setSending(false);
      router.refresh();
    }
  }

  return <section className="mt-8 rounded-xl border bg-white p-5 print:hidden">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">E-mails til kunden</h2>
      <button type="button" onClick={() => router.refresh()} className="text-sm underline">Opdatér historik</button>
    </div>
    <p className="mt-2 text-sm text-gray-500">Historikken omfatter mails sendt fra ordren efter aktivering af funktionen. Afsendt betyder, at mailtjenesten har modtaget mailen — det bekræfter ikke levering eller læsning.</p>
    <div className="my-5 space-y-3">
      {!available && <p role="alert" className="rounded-lg bg-amber-50 p-4 text-sm text-amber-900">Mailhistorikken er midlertidigt utilgængelig. Resten af ordren kan bruges som normalt. Manuel afsendelse er deaktiveret, indtil historikken er klar. Hvis funktionen netop er udgivet, skal databaseopdateringen gennemføres.</p>}
      {available && emails.length === 0 && <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">Ingen registrerede e-mails på denne ordre endnu.</p>}
      {emails.map(email => <details key={email.id} className="rounded-lg border p-4">
        <summary className="cursor-pointer">
          <span className="font-semibold">{email.subject}</span>
          <span className="mt-1 block text-sm text-gray-500">{date(email.sentAt || email.createdAt)} · {email.automatic ? "Automatisk" : "Manuel"} · {statuses[email.status] || email.status}</span>
        </summary>
        <dl className="my-4 grid gap-1 text-sm">
          <div><dt className="inline font-semibold">Type: </dt><dd className="inline">{kinds[email.kind] || email.kind}</dd></div>
          <div><dt className="inline font-semibold">Fra: </dt><dd className="inline break-all">{email.from}</dd></div>
          <div><dt className="inline font-semibold">Til: </dt><dd className="inline break-all">{email.to}</dd></div>
          <div><dt className="inline font-semibold">Udløst af: </dt><dd className="inline">{email.triggeredBy || "Systemet"}</dd></div>
          <div><dt className="inline font-semibold">Registreret: </dt><dd className="inline">{date(email.createdAt)} (dansk tid)</dd></div>
          {email.sentAt && <div><dt className="inline font-semibold">Afsendt: </dt><dd className="inline">{date(email.sentAt)} (dansk tid)</dd></div>}
        </dl>
        {email.error && <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">{email.error}</p>}
        <p className="mb-2 text-sm font-semibold">Præcist indhold ved afsendelse</p>
        <iframe title={`Mail: ${email.subject}`} sandbox="" referrerPolicy="no-referrer" className="h-[520px] w-full rounded border bg-white" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: http: data:; font-src 'none'; base-uri 'none'; form-action 'none'">${email.html}`} />
        <details className="mt-3 text-sm"><summary className="cursor-pointer text-gray-500">Vis gemt HTML</summary><pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded bg-gray-50 p-3 text-xs">{email.html}</pre></details>
      </details>)}
    </div>
    <form onSubmit={send} className="space-y-3 border-t pt-5">
      <h3 className="font-semibold">Send en opdatering</h3>
      <p className="text-sm text-gray-500">Til: {recipient || "Ingen e-mailadresse på ordren"}<br />Fra: {sender || "Afsender ikke konfigureret"}</p>
      <label className="block text-sm font-medium">Emne<input required maxLength={200} value={subject} disabled={sending} onChange={e => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
      <label className="block text-sm font-medium">Besked<textarea required maxLength={10000} rows={7} value={message} disabled={sending} onChange={e => setMessage(e.target.value)} placeholder="Skriv opdateringen til kunden her…" className="mt-1 w-full rounded-lg border p-3" /></label>
      <p className="text-xs text-gray-500">Beskeden sendes med klubbens navn og ordrenummer. Den ændrer ikke ordrens status.</p>
      <button disabled={!available || sending || !recipient || !sender || !subject.trim() || !message.trim()} className="rounded-lg bg-secondary px-5 py-3 font-semibold text-white disabled:opacity-50">{sending ? "Sender…" : "Send e-mail til kunden"}</button>
      {feedback && <p role="status" className="rounded-lg bg-gray-50 p-3 text-sm">{feedback}</p>}
    </form>
  </section>;
}
