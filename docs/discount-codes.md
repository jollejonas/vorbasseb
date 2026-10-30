# Rabatkoder og tilbud

Ved oprettelse af en kode kan administrator vælge **Erstat eksisterende tilbud**.

- Valgt: Kodens rabat beregnes fra normalprisen på omfattede produkter. Tilbuddet erstattes, også hvis tilbuddet ellers ville være billigere.
- Ikke valgt (standard): Tilbudsvarer beholder deres tilbudspris. Andre omfattede varer får kodens rabat.
- Et fast beløb gives én gang pr. ordre, højst værdien af de omfattede varer. Procent gives på alle omfattede enheder. Fragt rabatteres ikke.
- Produktspecifikke koder gælder alle varianter, men ikke produktet som del af et pakketilbud.
- "Alle nuværende produkter og pakketilbud" er et øjebliksbillede ved oprettelsen. Senere tilføjede produkter kræver en ny kode.
- Kunden indtaster koden i kurven og ser den beregnede pris før betaling. Ændres kurv eller levering, skal kunden anvende koden igen.
- Rabatkoden erstatter fanklubsrabat. Den kan ikke kombineres med tildelte produkter.

## Eksisterende koder

Eksisterende koder uden afkrydsningen har standardadfærden. Gamle koder uden produktbegrænsning i Stripe kan ikke anvendes i en kurv med tilbudsvarer; de skal genoprettes med den nye formular. Eksisterende koder og deres forbrug ændres ikke automatisk.

## Implementering og kontrol

Normalpris, tilbudsperiode, produkttilhørsforhold og tilvalg hentes på serveren. Forhåndsvisningen opretter hverken ordre eller betalingssession. Betalingen genberegner priser og kontrollerer koden igen. Stripe modtager den oprindelige promotion code, så anvendelsesgrænser, udløb og kundebegrænsninger stadig håndhæves af Stripe. Kunden kan ikke indtaste en anden kode på betalingssiden efter prisvalget.

Nye kuponer bruger eksplicitte Stripe-produkt-ID'er. Udelukkede tilbudsvarer får en separat produktidentitet i sessionen, og fragt sendes som fragt i stedet for en varelinje. Derfor kan kuponen ikke ramme de udelukkede beløb.

Automatisk kontrol: `node --test tests/promo-codes.test.cjs tests/confirmed-orders.test.cjs tests/preorder-stock.test.cjs`, `npx tsc --noEmit` samt ESLint på de ændrede TypeScript-filer.

Kontrollér desuden i Stripe-testtilstand før produktion: Opret en kode med og uden afkrydsning, læg både tilbudsvare og normalprisvare i kurven, anvend koden og sammenlign totalen i kurv, Stripe og den betalte ordre. Test fast beløb og procent, afhentning og fragt, opbrugte koder samt første-køb-begrænsningen. Ingen livebetalinger er udført som del af implementeringen.
