# Moms på ordrebekræftelser

Mail, bekræftelsesside, kundens ordredetaljer og administrationens udskrift viser beløb ekskl. moms, momsbeløb med sats og total inkl. moms. Opgørelsen tager udgangspunkt i den endelige total efter rabat og inklusive fragt. Beløbene afrundes i øre, så netto + moms altid er lig totalen.

Mailens momsopgørelse vises også, når administratoren har en tilpasset mailskabelon. Allerede afsendte mails og gemt mailhistorik ændres ikke.

## Udrulning

Koden fungerer både før og efter migrationen `20261109090000_order_vat_rate`. Prisma ignorerer feltet i almindelige ordrelæsninger og -skrivninger, så manglende migration ikke kan få disse til at fejle. Den særskilte lagring af satsen undersøger, om kolonnen findes, før den bruges; ingen manglende-kolonne-fejl skal fanges inde i en PostgreSQL-transaktion.

Uden migration bruges 25 % på ordredetaljer. Mail og bekræftelsesside for Stripe bruger betalingssessionens sats. Når migrationen er kørt, gemmes satsen ved betalingsbekræftelse. Ældre rækker får 25 %. Historiske undtagelser og ordrer med andre satser fra tiden før migrationen skal afstemmes med Stripe. Migrationen er fortsat anbefalet til varig lagring, men er ikke en forudsætning for at åbne ordresider eller betale.

Checkout gemmer satsen i betalingssessionen. Efter migrationen gemmer Stripe-bekræftelsen den også på ordren. Ordredetaljer bruger derefter ordrens sats frem for butikkens aktuelle indstilling. Der anvendes én fælles momssats for hele ordren, som i den eksisterende checkout.
