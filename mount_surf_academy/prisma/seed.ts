import "dotenv/config";
import { UserRole } from "@prisma/client";
import { randomBytes, scrypt as _scrypt } from "crypto";
import { promisify } from "util";
import { prisma } from "../lib/prisma";

// Adapter-based client infers PrismaClientOptions and loses equipment models in IDE; use asserted client
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const scrypt = promisify(_scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  // format: scrypt$$<saltHex>$<derivedKeyHex>
  return `scrypt$$${salt}$${derivedKey.toString("hex")}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("Missing DATABASE_URL");
  }

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

  const softboard = await db.equipmentCategory.upsert({
    where: { businessId_name: { businessId, name: "Softboard" } },
    update: {},
    create: {
      businessId,
      name: "Softboard",
      trackSizes: true,
    },
  });

  const wetsuit = await db.equipmentCategory.upsert({
    where: { businessId_name: { businessId, name: "Wetsuit" } },
    update: {},
    create: {
      businessId,
      name: "Wetsuit",
      trackSizes: true,
    },
  });

  const hardboard = await db.equipmentCategory.upsert({
    where: { businessId_name: { businessId, name: "Hardboard" } },
    update: {},
    create: {
      businessId,
      name: "Hardboard",
      trackSizes: true,
    },
  });

  const softboardSizes = ["6ft", "7ft", "8ft", "9ft", "10ft"];
  for (const label of softboardSizes) {
    await db.equipmentVariant.upsert({
      where: {
        categoryId_label: { categoryId: softboard.id, label },
      },
      update: {},
      create: {
        businessId,
        categoryId: softboard.id,
        label,
        totalQuantity: 3,
        isActive: true,
      },
    });
  }

  const wetsuitSizes = ["XS", "S", "M", "L", "XL", "XXL"];
  for (const label of wetsuitSizes) {
    await db.equipmentVariant.upsert({
      where: {
        categoryId_label: { categoryId: wetsuit.id, label },
      },
      update: {},
      create: {
        businessId,
        categoryId: wetsuit.id,
        label,
        totalQuantity: 4,
        isActive: true,
      },
    });
  }

  const hardboardSizes = ["6ft", "7ft", "8ft", "9ft"];
  for (const label of hardboardSizes) {
    await db.equipmentVariant.upsert({
      where: {
        categoryId_label: { categoryId: hardboard.id, label },
      },
      update: {},
      create: {
        businessId,
        categoryId: hardboard.id,
        label,
        totalQuantity: 2,
        isActive: true,
      },
    });
  }

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

