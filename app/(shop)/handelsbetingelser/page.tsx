import { Metadata } from "next";

export const metadata: Metadata = { title: "Handelsbetingelser" };

export default function HandelsbetingelserPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 prose prose-sm">
      <h1>Handelsbetingelser</h1>
      <p className="text-gray-500 text-sm">Sidst opdateret: januar 2025</p>

      <h2>1. Generelt</h2>
      <p>
        Disse handelsbetingelser gælder for alle køb foretaget i VBK Shoppen, der drives af
        Vorbasse Boldklub. Ved at gennemføre et køb accepterer du betingelserne nedenfor.
      </p>

      <h2>2. Bestilling og betaling</h2>
      <p>
        Alle priser er i danske kroner inkl. moms. Betaling sker sikkert via Stripe, der understøtter
        de mest udbredte betalingskort. Ordren er bindende, når du modtager en ordrebekræftelse på
        e-mail.
      </p>

      <h2>3. Levering</h2>
      <p>
        Vi leverer til adresser i Danmark. Forsendelse sker med PostNord eller GLS inden for 3–7
        hverdage fra afsendelsesdato. Gratis forsendelse ved køb over 499 kr. — ellers 49 kr.
      </p>
      <p>
        Alternativt kan du vælge afhentning ved Vorbasse Stadion. Vi giver besked via e-mail, når
        din ordre er klar.
      </p>

      <h2>4. Fortrydelsesret</h2>
      <p>
        Du har 14 dages fortrydelsesret fra modtagelse af varen, jf. forbrugeraftaleloven. Retten
        gælder ikke for varer, der er specialfremstillet eller personaliseret (f.eks. trøjer med
        navn/nummer tryk).
      </p>
      <p>
        Kontakt os på <a href="mailto:shop@vorbassebk.dk">shop@vorbassebk.dk</a> for at gøre
        fortrydelsesretten gældende.
      </p>

      <h2>5. Returnering og ombytning</h2>
      <p>
        Varer returneres i ubrugt og uvasket stand med original emballage. Returfragt betales af
        køber, medmindre varen er defekt eller fejlleveret. Refusion sker inden 14 dage efter
        modtagelse af den returnerede vare.
      </p>

      <h2>6. Reklamationsret</h2>
      <p>
        Der gives 2 års reklamationsret i henhold til købeloven. Reklamationsretten dækker fejl og
        mangler, der ikke skyldes forkert brug. Kontakt os på{" "}
        <a href="mailto:shop@vorbassebk.dk">shop@vorbassebk.dk</a> med beskrivelse og billeder af
        fejlen.
      </p>

      <h2>7. Fanklubsabonnement</h2>
      <p>
        Fanklubsabonnementet er et løbende abonnement, der automatisk fornyes månedligt eller
        årligt. Du kan til enhver tid opsige abonnementet fra din kontside. Opsigelse træder i kraft
        ved næste fornyelsesdato — du bevarer adgangen til udgangen af den betalte periode.
      </p>

      <h2>8. Ansvarsbegrænsning</h2>
      <p>
        Vorbasse Boldklub er ikke ansvarlig for indirekte tab, driftstab eller tab som følge af
        force majeure (herunder strejker, naturkatastrofer eller lignende).
      </p>

      <h2>9. Tvistløsning</h2>
      <p>
        Ved uenigheder opfordrer vi til at kontakte os direkte. Du kan også klage til Nævnenes Hus:{" "}
        <a href="https://www.naevneneshus.dk" target="_blank" rel="noopener noreferrer">
          naevneneshus.dk
        </a>
        . EU&apos;s online klagehåndteringsplatform:{" "}
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">
          ec.europa.eu/consumers/odr
        </a>
      </p>

      <h2>10. Kontakt</h2>
      <p>
        Vorbasse Boldklub
        <br />
        E-mail: <a href="mailto:shop@vorbassebk.dk">shop@vorbassebk.dk</a>
        <br />
        Vorbasse Stadion, Vorbasse
      </p>
    </div>
  );
}
