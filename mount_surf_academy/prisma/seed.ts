import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  // format: scrypt$$<saltHex>$<derivedKeyHex>
  return `scrypt$$${salt}$${derivedKey.toString("hex")}`;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("Missing DATABASE_URL");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString }),
  });

  const businessId = process.env.SEED_BUSINESS_ID ?? "seed_business";
  const businessName = process.env.SEED_BUSINESS_NAME ?? "Mount Surf Academy";
  const businessLocation =
    process.env.SEED_BUSINESS_LOCATION ?? "Mount Maunganui, New Zealand";

  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? "owner@mountsurf.local")
    .trim()
    .toLowerCase();
  const ownerName = process.env.SEED_OWNER_NAME ?? "Owner";
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

  const business = await prisma.business.upsert({
    where: { id: businessId },
    update: {
      name: businessName,
      location: businessLocation,
    },
    create: {
      id: businessId,
      name: businessName,
      location: businessLocation,
    },
  });

  const passwordHash = await hashPassword(ownerPassword);

  const owner = await prisma.user.upsert({
    where: { email: ownerEmail },
    update: {
      name: ownerName,
      passwordHash,
      role: UserRole.OWNER,
      businessId: business.id,
    },
    create: {
      name: ownerName,
      email: ownerEmail,
      passwordHash,
      role: UserRole.OWNER,
      businessId: business.id,
    },
  });

  console.log("Seed complete:", {
    business: { id: business.id, name: business.name },
    owner: { id: owner.id, email: owner.email, role: owner.role },
  });

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
});

