# Ordrenumre efter gennemført køb

Checkout gemmes fortsat internt som PENDING, så et senere betalings-webhook kan
færdiggøre købet. Forsøget har intet ordrenummer og vises hverken i admin,
ordrestatistik eller kundens ordrehistorik. Direkte adgang og administrative
statusændringer af sådanne forsøg afvises.

Stripe-betalinger bekræftes kun, når sessionen er complete og payment_status er
paid eller no_payment_required. Forsinkede betalinger håndteres via
checkout.session.async_payment_succeeded. En gratis tildelt ordre bekræftes
direkte i checkout-transaktionen.

Ordrestatus, nummer, lager og brug af tildelinger ændres i samme transaktion.
Et atomisk statuskrav forhindrer, at samtidige webhooks/returvisninger bekræfter
samme ordre to gange. Nummereringen bruger en transaktionel tæller frem for en
PostgreSQL-sekvens, så et rollback heller ikke forbruger et nummer.
Ordredatoen sættes til bekræftelsestidspunktet for fremtidige Stripe-køb.
Webhook-fejl returnerer nu 500, så Stripe genforsøger.

## Udgivelse – databaseændring påkrævet

1. Tag backup og afprøv migrationen på en kopi af produktionsdatabasen.
2. Koordinér et kort vedligeholdelsesvindue: stop nye checkout-forsøg og hold
   betalings-webhooks tilbage, indtil både migration og ny kode er aktive.
   Lad ikke gamle serverinstanser behandle ordrer efter migrationen.
3. Kontrollér migrationshistorikken, og kør `npx prisma migrate deploy` mod den
   tilsigtede database, med migrationsforbindelsen konfigureret som normalt.
   Migrationen hedder `20261030120000_confirmed_order_numbers`.
4. Udgiv koden, kontrollér at Stripe-webhooket også modtager
   `checkout.session.async_payment_succeeded`, og genoptag trafikken.
5. Afprøv et afbrudt checkout, en betaling, et gentaget webhook og en gratis
   trænerordre. Genafspil tilbageholdte Stripe-events efter udgivelsen.

Migrationen bevarer alle numre på gennemførte ordrer og starter tælleren ved
det hidtil højeste nummer, inklusive gamle forsøg. Gamle huller genbruges ikke.
Kun PENDING-posters numre fjernes; ingen ordrer, varer eller betalinger slettes.
Eventuelle betalte køb med fejlede gamle webhooks skal afstemmes mod Stripe og
deres events genafspilles. Automatisk oprydning af checkout-data er ikke ændret.

En kode-rollback kræver en særskilt databaseplan: den gamle kode forventer et
automatisk ordrenummer. Rul ikke blot applikationen tilbage efter migrationen.

## Validering

- `node --test tests/confirmed-orders.test.cjs tests/preorder-stock.test.cjs`
- `npx tsc --noEmit`
- Migrationen er afprøvet lokalt i PostgreSQL via PGlite: bevarede numre,
  nullable checkout-numre, transaktionelt rollback og unikhedsbegrænsning.
- Produktionens database og rigtige Stripe-betalinger er ikke ændret/testet.
