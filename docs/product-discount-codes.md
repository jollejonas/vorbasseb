# Produktbegrænsede rabatkoder

I Admin → Rabatkoder kan “Gælder for” være “Alle produkter” eller ét produkt.
Brug fx TRAENERJULESWEATER2026; Æ, Ø og Å er ikke gyldige Stripe-kodetegn.
Valideringsfejl vises nu konkret i stedet for altid at henvise til Stripe-nøglen.

En kode på 275 kr. gælder én gang pr. ordre, højst det valgte produkts samlede
værdi. Den gælder alle produktets størrelser/farver, også fremtidige varianter,
men ikke andre varer, fragt eller produktet som del af et pakketilbud.
Procentrabat gælder det valgte produkts linjer, inklusive deres tilvalg.
Eksisterende regler om ikke at kombinere tilbud, fanklubsrabat, tildelinger og
rabatkoder er bevaret. Koden indtastes hos Stripe ved betaling.

Udløbsdatoen er til og med kl. 23:59:59 dansk tid. “Kun nye kunder” er Stripes
first_time_transaction-regel; det er ikke en generel begrænsning på én gang pr.
eksisterende kunde.

## Implementering og udgivelse

Ingen databasemigration. Stripe-produkter får stabile ID'er `vbk_<produkt-id>`.
Checkout og coupon.applies_to bruger samme ID, afledt af data på serveren.
Stripe Checkout viser det fælles produktnavn/billede; størrelse og tryk er stadig
gemt på ordren og vises i kurven og ordredetaljerne. Nye Checkout-sessioner er
nødvendige for produktbegrænsede koder; gamle åbne sessioner har midlertidige
Stripe-produkt-ID'er. Bed kunden gå tilbage til kurven og starte betalingen igen.

Stripe-nøglen skal tillade Products read/write, Coupons read/write og Promotion
Codes read/write. Fejl logges med Stripe request ID, uden hemmelig nøgle.
Faktisk rabat fra Stripe gemmes på ordren, når betalingen gennemføres.

Automatiske tests bruger simulerede Stripe/database-svar. Før udgivelse afprøves
i Stripe testtilstand: kun sweater, blandet kurv, kun andre varer, flere sweatere,
fragt, beløb større end sweaterens værdi, procentrabat og genstart af gammel
Checkout-session. Kontrollér derefter kvittering, total og rabat på ordren.
