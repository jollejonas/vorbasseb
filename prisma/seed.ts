import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Stable IDs so the seed is idempotent on re-run
const SLIDE_IDS = {
  custom: "seed-slide-custom-0001",
  news: "seed-slide-news-00002",
  product: "seed-slide-product-003",
};

async function main() {
  // ── Admin user ──────────────────────────────────────────────────────────
  const password = "Admin1234!";
  const passwordHash = await hash(password, 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@vorbassebk.dk" },
    update: {},
    create: {
      email: "admin@vorbassebk.dk",
      name: "Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  console.log("✅ Admin:", admin.email);

  // ── Site settings ────────────────────────────────────────────────────────
  const settingsData = [
    { key: "footer_phone", value: "+45 XX XX XX XX" },
    { key: "footer_email", value: "shop@vorbassebk.dk" },
    { key: "shipping_flat_ore", value: "4900" },
    { key: "shipping_free_ore", value: "49900" },
    { key: "member_discount_pct", value: "10" },
  ];
  for (const s of settingsData) {
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    });
  }
  console.log("✅ Site settings seeded");

  // ── Products ─────────────────────────────────────────────────────────────
  const products = [
    {
      slug: "spillertroje-2025",
      name: "Spillertrøje 2025",
      description:
        "Den officielle Vorbasse Boldklub spillertrøje for sæson 2025. Lavet i åndbart, fugtafvisende materiale med klubbens farver og logo. Perfekt til kampdagen eller hverdagsbrug.",
      category: "SPILLERTOJ" as const,
      price: 49900,
      customizationFee: 7500,
      published: true,
      featured: true,
      images: ["https://picsum.photos/seed/vbk-troeje/800/800"],
      skus: [
        { size: "S", stock: 10 },
        { size: "M", stock: 15 },
        { size: "L", stock: 20 },
        { size: "XL", stock: 10 },
        { size: "XXL", stock: 5 },
      ],
    },
    {
      slug: "traeningstroje-vbk",
      name: "Træningstrøje VBK",
      description:
        "Komfortabel træningstrøje til Vorbasse Boldklubs spillere og trænere. Let materiale der holder dig kold under intens træning. Disponibel i klubbens farver.",
      category: "BLAEDNING" as const,
      price: 29900,
      customizationFee: null,
      published: true,
      featured: true,
      images: ["https://picsum.photos/seed/vbk-traening/800/800"],
      skus: [
        { size: "S", stock: 8 },
        { size: "M", stock: 12 },
        { size: "L", stock: 15 },
        { size: "XL", stock: 8 },
      ],
    },
    {
      slug: "vbk-halstorklaede",
      name: "VBK Halstørklæde",
      description:
        "Hold varmen på tribunen med VBK's officielle halstørklæde i klubbens farver gul og blå. Et must-have for alle fans.",
      category: "MERCHANDISE" as const,
      price: 14900,
      customizationFee: null,
      published: true,
      featured: false,
      images: ["https://picsum.photos/seed/vbk-halstorklaede/800/800"],
      skus: [{ size: "ONE SIZE", stock: 25 }],
    },
    {
      slug: "vbk-kasket",
      name: "VBK Kasket",
      description:
        "Klassisk snapback-kasket med broderet VBK-logo. Justerbar størrelse passer alle. Perfekt til at vise din støtte til holdet.",
      category: "MERCHANDISE" as const,
      price: 12900,
      customizationFee: null,
      published: true,
      featured: false,
      images: ["https://picsum.photos/seed/vbk-kasket/800/800"],
      skus: [{ size: "ONE SIZE", stock: 30 }],
    },
  ];

  const seededProducts: Record<string, string> = {}; // slug → id
  for (const p of products) {
    const { skus, ...productData } = p;
    const existing = await prisma.product.findUnique({ where: { slug: p.slug }, select: { id: true } });
    if (existing) {
      seededProducts[p.slug] = existing.id;
      console.log(`  ↳ Product already exists: ${p.name}`);
      continue;
    }
    const created = await prisma.product.create({
      data: {
        ...productData,
        skus: { create: skus },
      },
      select: { id: true },
    });
    seededProducts[p.slug] = created.id;
    console.log(`  ↳ Created product: ${p.name}`);
  }
  console.log("✅ Products seeded");

  // ── News posts ───────────────────────────────────────────────────────────
  const newsPosts = [
    {
      slug: "ny-saeson-2025",
      title: "Ny sæson 2025 – hold dig opdateret",
      content: `Vorbasse Boldklub byder velkommen til en ny og spændende sæson!\n\nVi glæder os til at se alle spillere, trænere og frivillige på banen igen. I år har vi store forventninger til holdet, og vi regner med at stille stærkt i alle rækker.\n\nHold øje med vores hjemmeside og butik for de seneste nyheder om kampe, resultater og nyt merchandise. Støt holdet ved at iføre dig det officielle spillertøj!`,
      publishedAt: new Date("2025-01-15T10:00:00Z"),
    },
    {
      slug: "vbk-henter-tre-point",
      title: "VBK henter tre point i dramatisk opgør",
      content: `Vorbasse Boldklub leverede en fantastisk præstation i weekendens kamp og hentede alle tre point hjem.\n\nKampen var tæt fra start til slut, men en sen scoring i kampens afsluttende minutter sikrede sejren. Mål af nr. 9 i det 88. minut satte det endelige punktum i en kamp, der viste alt det bedste ved lokal fodbold.\n\nMandskabet fejres nu og ser frem til næste kamp. Tak til alle fans der mødte op og støttede holdet!`,
      publishedAt: new Date("2025-02-10T18:30:00Z"),
    },
  ];

  for (const np of newsPosts) {
    await prisma.newsPost.upsert({
      where: { slug: np.slug },
      update: {},
      create: np,
    });
  }
  console.log("✅ News posts seeded");

  // ── Orders ───────────────────────────────────────────────────────────────
  // Only create if the admin has no orders yet
  const existingOrders = await prisma.order.count({ where: { userId: admin.id } });
  if (existingOrders === 0) {
    const address = await prisma.address.create({
      data: {
        userId: admin.id,
        name: "Admin Testperson",
        line1: "Testgade 1",
        city: "Vorbasse",
        postcode: "6623",
        country: "DK",
      },
    });

    const troejeSku = await prisma.sKU.findFirst({
      where: { product: { slug: "spillertroje-2025" }, size: "M" },
    });
    const traeningsSku = await prisma.sKU.findFirst({
      where: { product: { slug: "traeningstroje-vbk" }, size: "L" },
    });

    if (troejeSku) {
      await prisma.order.create({
        data: {
          userId: admin.id,
          status: "PAID",
          total: 54800,
          shippingFee: 4900,
          discountApplied: 0,
          addressId: address.id,
          items: {
            create: [
              {
                skuId: troejeSku.id,
                quantity: 1,
                priceAtPurchase: 49900,
              },
            ],
          },
        },
      });
    }

    if (traeningsSku) {
      await prisma.order.create({
        data: {
          userId: admin.id,
          status: "SHIPPED",
          total: 29900,
          shippingFee: 0,
          discountApplied: 0,
          addressId: address.id,
          items: {
            create: [
              {
                skuId: traeningsSku.id,
                quantity: 1,
                priceAtPurchase: 29900,
              },
            ],
          },
        },
      });
    }
    console.log("✅ Sample orders seeded");
  } else {
    console.log("  ↳ Orders already exist, skipping");
  }

  // ── Hero slides ──────────────────────────────────────────────────────────
  await prisma.heroSlide.upsert({
    where: { id: SLIDE_IDS.custom },
    update: {},
    create: {
      id: SLIDE_IDS.custom,
      type: "CUSTOM",
      position: 0,
      enabled: true,
      heading: "Vorbasse Boldklub",
      subheading: "Officiel merchandise-butik",
      body: "Støt dit hold med officielle trøjer og træningsudstyr. Fri fragt over 499 kr.",
      imageUrl: "https://picsum.photos/seed/vbk-hero/1600/900",
      ctaLabel: "Se butikken",
      ctaHref: "/butik",
      overlayOpacity: 50,
    },
  });

  await prisma.heroSlide.upsert({
    where: { id: SLIDE_IDS.news },
    update: {},
    create: {
      id: SLIDE_IDS.news,
      type: "LATEST_NEWS",
      position: 1,
      enabled: true,
      overlayOpacity: 55,
    },
  });

  await prisma.heroSlide.upsert({
    where: { id: SLIDE_IDS.product },
    update: {},
    create: {
      id: SLIDE_IDS.product,
      type: "LATEST_PRODUCT",
      position: 2,
      enabled: true,
      overlayOpacity: 45,
    },
  });
  console.log("✅ Hero slides seeded");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
