import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adapter = new PrismaPg(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

const sizes = ["XS", "S", "M", "L", "XL", "XXL", "116", "128", "140", "152", "164", "One Size"];

async function main() {
  for (let i = 0; i < sizes.length; i++) {
    await prisma.sizePreset.upsert({
      where: { label: sizes[i] },
      update: { position: i },
      create: { label: sizes[i], position: i },
    });
  }
  console.log("Seeded", sizes.length, "size presets");
}

main().then(() => prisma.$disconnect()).catch(console.error);
