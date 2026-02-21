# Produktkravsdokument (PRD)
## Vorbasse Boldklub — Merchandise Webshop

**Version:** 1.0
**Dato:** 21. februar 2026
**Status:** Godkendt

---

## 1. Baggrund og formål

Vorbasse Boldklub ønsker en officiel online merchandise-butik, der giver klubbens fans mulighed for at købe trøjer, træningsudstyr og andre fanartikler direkte fra klubben. Derudover skal butikken understøtte et fanklubsabonnement, der giver medlemmer rabat og adgang til eksklusive produkter.

### Mål

- Gøre det nemt for fans at købe officielle Vorbasse Boldklub merchandise-artikler online
- Øge klubbens indtjening via direkte salg
- Skabe en digital fanklub med løbende abonnementsindtægt
- Give klubbens administratorer et simpelt panel til at styre produkter, ordrer og nyheder

---

## 2. Brugerroller

| Rolle | Muligheder |
|---|---|
| **Gæst** | Browse katalog, søg, se produktdetaljer, læg i kurv, gæstekasse |
| **Kunde** | Alt som gæst + brugerkonto med ordrehistorik, mulighed for fanklubsabonnement |
| **Fanklubsmedlem** | Alt som kunde + 10% rabat på alle køb + adgang til eksklusivt klub-merchandise |
| **Admin** | Fuld CRUD på produkter/nyheder, ordrehåndtering, lagerstyring, brugeradministration |

---

## 3. Teknisk stack

| Lag | Valg | Begrundelse |
|---|---|---|
| Frontend + API | Next.js 14 (App Router) + TypeScript | SSR til SEO, API routes erstatter separat backend |
| Database | PostgreSQL + Prisma ORM | Relationel model, type-sikre forespørgsler |
| Auth | NextAuth.js | E-mail/adgangskode + sessionstyring out of the box |
| Betaling | Stripe (Checkout + Subscriptions) | Engangskøb og abonnementer |
| Billeder | Cloudinary | Generøst gratis niveau, auto-optimering, upload fra admin |
| E-mail | Resend + React Email | Moderne, 3.000 e-mails/mdr gratis, Next.js-venlig |
| Styling | Tailwind CSS | Utility-first, hurtig mobile-first udvikling |
| Hosting | Vercel + Supabase (PostgreSQL) | Zero-config deploy, managed database |

---

## 4. Kernefunktioner (v1)

### 4.1 Produktkatalog

- Grid-visning af produkter med billeder, navn, pris og størrelsesindikator
- Filtrer på kategori: **Trøjer** og **Træning**
- Simpel tekstsøgning på produkt- og beskrivelsesfelter
- Produktdetaljeside med størrelsesvalg (pilvælger), lagerindikator ("Kun 2 tilbage"), og galleribilleder
- Eksklusivt fanklub-merchandise vises for ikke-medlemmer som låst kort med hængelåsikon og "Kun for fanklubsmedlemmer"-badge
- Valgfri trykpersonalisering (navn + nummer) ved trøjer — vises som tilvalg med ekstra pris

### 4.2 Indkøbskurv og kasse

- Persistent kurv: localStorage for gæster, server-synkroniseret for indloggede brugere
- Kurvsiden viser produkter, størrelser, mængder, eventuel personalisering og samlet pris
- Gæstekasse: ingen konto nødvendig — kun e-mailadresse til ordrebekræftelse
- Stripe Checkout (hosted) til betaling — holder PCI-omfang minimalt
- Fragtgebyr beregnes server-side: **49 kr** flat rate, **gratis** over 499 kr
- Fanklubsmedlemmer: 10% rabat påføres automatisk server-side ved oprettelse af Stripe Checkout session
- Personalisering (trøjenavn/-nummer) tilføjes som separat linjepost i Stripe

### 4.3 Brugerkonti

- Registrering og login med e-mail + adgangskode (NextAuth Credentials)
- Ordrehistorik: liste over alle tidligere ordrer med status og detaljer
- Profilside: navn og adresse
- Gæstebrugere kan ikke se ordrehistorik — dette kommunikeres tydeligt i kassen

### 4.4 Fanklubsabonnement

- To abonnementsplaner via Stripe Subscriptions:
  - **Månedligt** (pris fastsættes af klubben)
  - **Årligt** (pris fastsættes af klubben, evt. rabat ift. månedlig)
- Fordele for medlemmer:
  - **10% rabat** på alle køb i butikken (påføres server-side)
  - Adgang til **eksklusivt merchandise** (skjult/låst for ikke-medlemmer)
- Abonnement kan til- og frameldes fra kontosiden
- Webhook-håndtering for betalingsfejl: bruger notificeres og abonnement markeres PAST_DUE

### 4.5 Admin-panel (`/admin`)

- **Dashboard**: antal ordrer (dag/uge/måned), omsætning, aktive fanklubsmedlemmer
- **Produkter**: tabel med billede, navn, kategori, pris, totalt lager. Opret/rediger/slet, Cloudinary-billedupload, slå "Kun for medlemmer" og "Udgivet" til/fra
- **Ordrer**: filtrerbar tabel efter status. Klik på ordre for detaljer inkl. personalisering. Skift status (Afventer → Betalt → Afsendt → Leveret)
- **Nyheder**: opret/rediger nyhedsindlæg med markdown, udgiv/fjern fra forsiden
- **Brugere**: liste over admin-brugere, inviter ny admin via e-mail

---

## 5. Sider og ruter

| Rute | Dansk navn | Beskrivelse |
|---|---|---|
| `/` | Forside | Hero-banner, udvalgte produkter, nyheder, fanklub-CTA |
| `/butik` | Butik | Fuldt katalog med kategorifiler og søgning |
| `/butik/[slug]` | Produktside | Produktdetaljer, størrelsesvalg, lagerindikator, personalisering |
| `/kurv` | Kurv | Kurvoversigt med opsummering og redigering |
| `/kasse` | Kasse | Stripe Checkout-omdirigering (session oprettet server-side) |
| `/ordre-bekraeftelse` | Ordrebekræftelse | Bekræftelsesside efter vellykket betaling |
| `/mine-ordrer` | Mine ordrer | Kundens ordrehistorik (kræver login) |
| `/konto` | Konto | Profilindstillinger og abonnementsstyring (kræver login) |
| `/fanklub` | Fanklub | Fordele, priser og tilmeldingsknap |
| `/fanklub/tak` | Tak | Successide efter fanklubstilmelding |
| `/nyheder` | Nyheder | Liste over klubnyheder |
| `/nyheder/[slug]` | Nyhedsartikel | Enkelt nyhedsindlæg |
| `/admin` | Admin | Kontrolpanel (kræver admin-rolle) |
| `/admin/produkter` | Produkter | Produktliste og CRUD |
| `/admin/ordrer` | Ordrer | Ordrehåndtering og statusopdatering |
| `/admin/nyheder` | Nyheder | Nyhedsstyring |
| `/admin/brugere` | Brugere | Admin-brugeradministration |

---

## 6. API-ruter

| Metode | Rute | Auth | Formål |
|---|---|---|---|
| GET | `/api/products` | Offentlig | Liste udgivne produkter (filter, søgning) |
| GET | `/api/products/[id]` | Offentlig* | Produktdetaljer (*eksklusivt håndhæves server-side) |
| POST | `/api/products` | Admin | Opret produkt |
| PUT | `/api/products/[id]` | Admin | Opdater produkt |
| DELETE | `/api/products/[id]` | Admin | Slet produkt |
| POST | `/api/checkout` | Offentlig | Opret Stripe Checkout-session (anvend evt. medlemsrabat) |
| POST | `/api/subscribe` | Login | Opret Stripe Subscription-session |
| POST | `/api/webhooks/stripe` | Stripe-signatur | Håndter betalings- og abonnementshændelser |
| GET | `/api/orders` | Login | Kunde: egne ordrer. Admin: alle ordrer |
| PUT | `/api/orders/[id]` | Admin | Opdater ordrestatus |
| GET | `/api/news` | Offentlig | Liste udgivne nyheder |
| POST/PUT/DELETE | `/api/news/[id]` | Admin | Nyheds-CRUD |

---

## 7. Datamodeller (Prisma-skema)

```prisma
model User {
  id           String        @id @default(cuid())
  email        String        @unique
  passwordHash String?
  name         String?
  role         Role          @default(CUSTOMER)
  createdAt    DateTime      @default(now())
  orders       Order[]
  addresses    Address[]
  subscription Subscription?
}

enum Role { CUSTOMER ADMIN }

model Subscription {
  id                   String    @id @default(cuid())
  userId               String    @unique
  user                 User      @relation(fields: [userId], references: [id])
  stripeSubscriptionId String    @unique
  stripeCustomerId     String
  status               SubStatus
  plan                 Plan
  currentPeriodEnd     DateTime
  createdAt            DateTime  @default(now())
}

enum SubStatus { ACTIVE CANCELED PAST_DUE }
enum Plan      { MONTHLY YEARLY }

model Product {
  id               String   @id @default(cuid())
  name             String
  slug             String   @unique
  description      String
  category         Category
  price            Int      // øre (DKK × 100)
  customizationFee Int?     // øre — kun relevant for trøjer
  membersOnly      Boolean  @default(false)
  published        Boolean  @default(true)
  images           String[] // Cloudinary-URL'er
  skus             SKU[]
  createdAt        DateTime @default(now())
}

enum Category { TRØJE TRÆNING }

model SKU {
  id         String      @id @default(cuid())
  productId  String
  product    Product     @relation(fields: [productId], references: [id])
  size       String      // "XS","S","M","L","XL","XXL","116","128","140","152","164"
  stock      Int         @default(0)
  orderItems OrderItem[]
}

model Order {
  id              String      @id @default(cuid())
  userId          String?     // null ved gæstekøb
  user            User?       @relation(fields: [userId], references: [id])
  guestEmail      String?
  status          OrderStatus @default(PENDING)
  stripeSessionId String?     @unique
  stripePaymentId String?
  total           Int         // øre
  discountApplied Int         @default(0) // øre
  shippingFee     Int         // øre
  items           OrderItem[]
  shippingAddress Address?    @relation(fields: [addressId], references: [id])
  addressId       String?
  createdAt       DateTime    @default(now())
}

enum OrderStatus { PENDING PAID SHIPPED DELIVERED REFUNDED }

model OrderItem {
  id              String  @id @default(cuid())
  orderId         String
  order           Order   @relation(fields: [orderId], references: [id])
  skuId           String
  sku             SKU     @relation(fields: [skuId], references: [id])
  quantity        Int
  priceAtPurchase Int     // øre
  customName      String? // valgfrit trøjenavn
  customNumber    String? // valgfrit trøjenummer
}

model Address {
  id       String  @id @default(cuid())
  userId   String?
  user     User?   @relation(fields: [userId], references: [id])
  line1    String
  line2    String?
  city     String
  postcode String
  country  String  @default("DK")
  orders   Order[]
}

model NewsPost {
  id          String    @id @default(cuid())
  title       String
  slug        String    @unique
  content     String    // markdown
  publishedAt DateTime?
  createdAt   DateTime  @default(now())
}
```

---

## 8. Stripe-integration

### Engangskøb (Stripe Checkout)
- Server opretter en Checkout Session med linjepost pr. vare i kurven
- Hvis brugeren er aktivt fanklubsmedlem: 10% rabat påføres server-side via Stripe-kupon eller justerede enhedspriser
- Valgfri trykpersonalisering tilføjes som separat linjepost med `customizationFee`
- Webhook `checkout.session.completed`: opret ordre i DB, dekrementer lager i Prisma-transaktion, send Resend-bekræftelse

### Fanklubsabonnement (Stripe Subscriptions)
- To Stripe Price-ID'er: `PRICE_MONTHLY` og `PRICE_YEARLY` (oprettes i Stripe Dashboard)
- `customer.subscription.created/updated` → upsert Subscription-record i DB
- `customer.subscription.deleted` → status CANCELED, fjern rabatadgang
- `invoice.payment_failed` → status PAST_DUE, send advarselsemail via Resend

### Sikkerhed
- Webhook-signaturer verificeres med `stripe.webhooks.constructEvent()`
- Rabat håndhæves udelukkende server-side — klienten kan aldrig selv angive rabat
- Eksklusivt merchandise: `/api/products/[id]` returnerer HTTP 403 hvis `membersOnly && !isActiveMember`

---

## 9. E-mailskabeloner (Resend + React Email)

| Skabelon | Udløser | Indhold |
|---|---|---|
| **Ordrebekræftelse** | `checkout.session.completed` | Ordresammenfatning, varer, total, leveringsadresse |
| **Forsendelsesbekræftelse** | Admin markerer ordre som AFSENDT | Besked om afsendelse, evt. trackingnummer |
| **Fanklub-velkomst** | `customer.subscription.created` | Velkomst, fordelsoversigt, info om 10% rabat |
| **Betalingsfejl** | `invoice.payment_failed` | Advarsel, link til opdatering af betalingsmetode |

---

## 10. Design og UX

### Farver
| Token | Hex | Brug |
|---|---|---|
| `primary` | `#F5C400` | Primærknapper, accenter, hover-states |
| `secondary` | `#003DA5` | Header, footer, sekundære knapper |
| `background` | `#FFFFFF` | Sidebagggrund |
| `surface` | `#F9F9F9` | Korte, inputfelter |
| `text` | `#111111` | Brødtekst |

### Principper
- **Mobile-first**: layout designes til 375 px og skaleres op til desktop
- **Typografi**: Inter eller Geist sans-serif
- **Komponenter**:
  - Sticky header med kurvikonet (antal-badge) + fanklubs-badge til medlemmer
  - Mobilmenu som hamburger-overlay
  - Produktkort med hover-overlay og hurtig "Læg i kurv"
  - Størrelsespillede knapper med deaktiveret tilstand ved tomt lager
  - Hængelåskort for låst eksklusivt merchandise

---

## 11. Forsiden (/)

Forsidens sektioner i rækkefølge:
1. **Hero-banner**: fuld bredde, klubbillede, headline og CTA-knap til butikken
2. **Udvalgte produkter**: 3–6 fremhævede produkter (markeret i admin)
3. **Nyheder**: 3 seneste nyhedsindlæg med titel, dato og læs-mere-link
4. **Fanklub-CTA**: fremtrædende sektion med fordele og tilmeldingsknap

---

## 12. Forsendelse (Danmark)

| Regel | Værdi |
|---|---|
| Standard fragtgebyr | 49 kr |
| Gratis fragt over | 499 kr |
| Leveringsland | Kun Danmark (DK) |
| Leveringstid (vejledende) | 2–5 hverdage |

Fragtgebyr beregnes server-side i `/api/checkout` ud fra ordretotal før rabat.

---

## 13. Kendte kompromisser og risici

| Udfordring | Beslutning |
|---|---|
| Stripe Subscriptions tilføjer webhook-kompleksitet | Én `/api/webhooks/stripe`-handler med event-type routing |
| Gæstekasse → bruger-ID kan være null | `guestEmail` gemmes på ordren; gæster kan ikke se ordrehistorik |
| Rabat skal håndhæves server-side | Aldrig stol på klienten; tjek abonnementsstatus i API før checkout |
| Eksklusivt merchandise for ikke-medlemmer | Vis låst produktkort med hængelåsikon og opgraderingslink |
| Trykpersonalisering som tillæg | Separat Stripe-linjepost; `customName`/`customNumber` på OrderItem |
| Lager-race conditions ved samtidige køb | Brug Prisma-transaktioner ved lagerdekrement i webhook |

---

## 14. Uden for scope (v1)

- Rabatkoder og kampagner
- Multi-valuta eller international forsendelse
- Produktanmeldelser og stjernebedømmelser
- Avanceret søgning (Algolia)
- Affiliateprogram
- Varianter ud over størrelse (f.eks. farvevalg på trøjer)

---

## 15. Verifikationscheckliste

- [ ] **Gæst**: Browse `/butik` → læg trøje i kurv → vælg personalisering → gennemfør kasse → modtag Resend-bekræftelse
- [ ] **Gæst**: forsøg at se eksklusivt fanklubsprodukt → ser låst kort med opgraderingslink
- [ ] **Kunde**: registrer → log ind → tilmeld fanklub (månedligt) → bekræft 10% rabat ved næste køb
- [ ] **Stripe webhook**: kør `stripe listen --forward-to localhost:3000/api/webhooks/stripe`, gennemfør testbetaling, bekræft at ordrestatus opdateres til PAID og lager dekrementeres
- [ ] **Admin**: opret produkt med Cloudinary-billede → udgiv → synligt i `/butik`
- [ ] **Admin**: opdater ordrestatus til AFSENDT → Resend-e-mail afsendes
- [ ] **Abonnement opsigelse**: `stripe subscriptions cancel <id>` → member mister rabatadgang øjeblikkeligt
- [ ] **Mobil**: hele kasseflowen fungerer korrekt på 375 px viewport

---

## 16. Opsætningssteps (infrastruktur)

1. Opret Stripe-konto, konfigurer Checkout og to Subscription-priser (månedlig + årlig)
2. Opret Cloudinary-konto, hent cloud name og upload preset
3. Opret Resend-konto, verificer afsenderdomain
4. Opret Supabase-projekt, hent PostgreSQL connection string
5. Deploy til Vercel, tilslut environment variables
6. Registrer domæne (f.eks. `shop.vorbassebk.dk`) og peg på Vercel
7. Konfigurer Stripe webhook-endpoint til produktion-URL
