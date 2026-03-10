import { Metadata } from "next";

export const metadata: Metadata = { title: "Retur og ombytning – VBK Shoppen" };

export default function ReturPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 prose prose-sm">
      <h1>Retur og ombytning</h1>
      <p className="text-gray-500 text-sm">Sidst opdateret: marts 2026</p>

      <h2>1. Returret</h2>
      <p>
        Du har 14 dages returret fra den dag, du modtager din vare. Varen skal returneres i ubrugt
        stand og i original emballage. Personaliserede varer (med tryk, navn eller nummer) kan ikke
        returneres, medmindre der er tale om en fejl fra vores side.
      </p>

      <h2>2. Ombytning</h2>
      <p>
        Ønsker du at ombytte en vare til en anden størrelse eller farve, kontakter du os på
        vorbassebk@nemsport.dk inden for 14 dage fra modtagelse. Vi ombytte, så vidt det er muligt,
        mod betaling af eventuel prisforskel samt returfragt.
      </p>

      <h2>3. Fejl og mangler</h2>
      <p>
        Har du modtaget en fejlbehæftet eller beskadiget vare, beder vi dig kontakte os hurtigst
        muligt på vorbassebk@nemsport.dk med beskrivelse og billede. Vi sørger for at sende en ny
        vare eller tilbyde fuld refusion uden beregning.
      </p>

      <h2>4. Sådan returnerer du</h2>
      <ol>
        <li>Kontakt os på vorbassebk@nemsport.dk med ordrenummer og årsag til returnering.</li>
        <li>Pak varen sikkert ind og send den til: Vorbasse Stadion, Præstebrovej 27, 6622 Bække.</li>
        <li>Returnering sker for købers regning, medmindre der er tale om en fejl fra vores side.</li>
        <li>Vi behandler din retur inden for 5 hverdage efter modtagelse.</li>
      </ol>

      <h2>5. Refusion</h2>
      <p>
        Ved godkendt retur refunderes beløbet til den betalingsmetode, der blev brugt ved købet,
        inden for 5–10 hverdage.
      </p>

      <h2>6. Kontakt</h2>
      <p>
        Spørgsmål? Skriv til os på{" "}
        <a href="mailto:vorbassebk@nemsport.dk">vorbassebk@nemsport.dk</a>.
      </p>
    </div>
  );
}
