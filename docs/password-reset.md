# Glemt kodeord

Login-siden linker til `/glemt-kodeord`. Brugeren får en mail med et engangslink
til `/nulstil-kodeord`. Linket gælder i 15 minutter. En gennemført nulstilling
ugyldiggør øvrige nulstillingslinks og eksisterende login-sessioner ved næste
sessionskontrol. Sessioner fra før denne ændring kræver også nyt login.

## Opsætning

- `RESEND_API_KEY`: gyldig Resend API-nøgle.
- `RESEND_FROM_EMAIL`: afsender på et verificeret domæne.
- `NEXT_PUBLIC_APP_URL` (alternativt `NEXTAUTH_URL`): hjemmesidens korrekte
  HTTPS-adresse. Kun lokal udvikling tillader HTTP på localhost.
- Eksisterende `VerificationToken`-tabel bruges; ingen ny migration nødvendig.

Svaret afslører ikke, om en e-mail er registreret. Mailfejl logges på serveren
uden e-mailadresse eller token. Der er en databasebaseret pause på ét minut
pr. e-mail og samme IP-begrænsning som login. IP-begrænsningen er som hidtil
lokal pr. serverproces; den er ikke en global begrænsning på tværs af instanser.
Kun SHA-256-hash af tilfældige 256-bit tokens gemmes i databasen.

## Kontrol før udgivelse

Kør `node --test tests/password-reset.test.cjs` og TypeScript/ESLint-kontroller.
Afprøv derefter med en testkonto i et miljø med database og Resend:

1. Åbn login og vælg “Glemt kodeord?”.
2. Indtast kontoens e-mail og kontrollér, at mailens link bruger korrekt domæne.
3. Vælg et nyt kodeord; kontrollér at forskellige gentagelser afvises.
4. Kontrollér at nyt kodeord virker, gammelt kodeord afvises, og en tidligere
   login-session kræver nyt login ved næste sessionskontrol.
5. Genbrug linket og afprøv et udløbet link; begge skal afvises.
6. Kontrollér at en ukendt e-mail får samme besked, og at gentagne anmodninger
   inden for ét minut ikke sender ekstra mails.
