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

async function main() {
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

  console.log("✅ Admin user seeded:");
  console.log("   Email:   ", admin.email);
  console.log("   Password:", password);
  console.log("   Role:    ", admin.role);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
