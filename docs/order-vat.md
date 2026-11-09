# Moms på ordrebekræftelser

Mail, bekræftelsesside, kundens ordredetaljer og administrationens udskrift viser beløb ekskl. moms, momsbeløb med sats og total inkl. moms. Opgørelsen tager udgangspunkt i den endelige total efter rabat og inklusive fragt. Beløbene afrundes i øre, så netto + moms altid er lig totalen.

Mailens momsopgørelse vises også, når administratoren har en tilpasset mailskabelon. Allerede afsendte mails og gemt mailhistorik ændres ikke.

## Udrulning

Kør `npx prisma migrate deploy` mod produktionsdatabasen før den nye kode tages i brug. Migrationen `20261109090000_order_vat_rate` tilføjer ordrens momssats. Eksisterende ordrer får 25 %, som er butikkens hidtidige standardsats og den sats, der er angivet for denne ændring. Eventuelle historiske undtagelser skal kontrolleres før udrulning.

Nye ordrer gemmer satsen fra checkout. Stripe-bekræftelsen bruger den sats, som blev gemt i betalingssessionen. Ordredetaljer bruger derefter ordrens sats frem for butikkens aktuelle indstilling. Der anvendes én fælles momssats for hele ordren, som i den eksisterende checkout.
