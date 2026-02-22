import { Metadata } from "next";

export const metadata: Metadata = { title: "Privatlivspolitik" };

export default function PrivatlivspolitikPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 prose prose-sm">
      <h1>Privatlivs- og persondatapolitik</h1>
      <p className="text-gray-500 text-sm">Sidst opdateret: januar 2025</p>

      <h2>1. Dataansvarlig</h2>
      <p>
        Vorbasse Boldklub er dataansvarlig for behandlingen af de personoplysninger, vi modtager om
        dig via VBK Shoppen. Kontakt os på{" "}
        <a href="mailto:shop@vorbassebk.dk">shop@vorbassebk.dk</a> ved spørgsmål.
      </p>

      <h2>2. Hvilke oplysninger indsamler vi?</h2>
      <ul>
        <li>Navn og e-mailadresse (ved oprettelse af konto)</li>
        <li>Leveringsadresse (ved køb med levering)</li>
        <li>Betalingsoplysninger (behandles af Stripe – vi gemmer ikke kortdata)</li>
        <li>Ordrehistorik</li>
        <li>Kommunikationspræferencer (nyhedsbrevssamtykke)</li>
      </ul>

      <h2>3. Formål med behandlingen</h2>
      <p>Vi behandler dine personoplysninger til følgende formål:</p>
      <ul>
        <li>Opfyldelse af købs- og leveringsaftaler</li>
        <li>Kommunikation om din ordre</li>
        <li>Afsendelse af nyhedsbreve (kun med dit samtykke)</li>
        <li>Administration af fanklubsmedlemskab</li>
        <li>Forbedring af vores tjenester</li>
      </ul>

      <h2>4. Retsgrundlag</h2>
      <p>
        Vi behandler dine oplysninger med hjemmel i GDPR artikel 6, stk. 1, litra b (opfyldelse af
        kontrakt) og litra a (samtykke, for nyhedsbreve).
      </p>

      <h2>5. Opbevaring</h2>
      <p>
        Vi opbevarer dine personoplysninger så længe, det er nødvendigt til de beskrevne formål, og
        i henhold til gældende lovgivning (bl.a. bogføringsloven kræver 5 års opbevaring af
        regnskabsdata).
      </p>

      <h2>6. Dine rettigheder</h2>
      <p>Du har ret til at:</p>
      <ul>
        <li>Få indsigt i de oplysninger, vi har om dig</li>
        <li>Få urigtige oplysninger berigtiget</li>
        <li>Få dine oplysninger slettet (under visse betingelser)</li>
        <li>Gøre indsigelse mod behandlingen</li>
        <li>Tilbagekalde et givet samtykke til enhver tid</li>
      </ul>
      <p>
        Kontakt os på <a href="mailto:shop@vorbassebk.dk">shop@vorbassebk.dk</a> for at udøve dine
        rettigheder.
      </p>

      <h2>7. Cookies</h2>
      <p>
        VBK Shoppen anvender tekniske cookies, der er nødvendige for sidens funktion (fx session og
        kurv). Vi anvender ingen reklame- eller sporingscookies fra tredjepart.
      </p>

      <h2>8. Tredjepart</h2>
      <p>
        Vi deler dine oplysninger med følgende tredjeparter, udelukkende i det omfang det er
        nødvendigt:
      </p>
      <ul>
        <li>
          <strong>Stripe</strong> – til betalingsbehandling. Stripe er databehandler og opbevarer
          kortdata sikkert.
        </li>
        <li>
          <strong>Resend</strong> – til afsendelse af transaktionelle e-mails.
        </li>
        <li>
          <strong>Supabase / PostgreSQL</strong> – til sikker databasehosting i EU.
        </li>
      </ul>

      <h2>9. Klage</h2>
      <p>
        Du har ret til at indgive klage til Datatilsynet:{" "}
        <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener noreferrer">
          datatilsynet.dk
        </a>
      </p>
    </div>
  );
}
