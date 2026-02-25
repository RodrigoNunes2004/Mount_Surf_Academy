import { NextResponse, type NextRequest } from "next/server";
import { EquipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const EQUIPMENT_STATUSES = Object.values(EquipmentStatus);

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  const take = Math.min(Math.max(Number(takeRaw ?? 50) || 50, 1), 200);
  const skip = Math.max(Number(skipRaw ?? 0) || 0, 0);

  const equipment = await prisma.equipment.findMany({
    where: {
      businessId,
      ...(q
        ? {
            OR: [
              { category: { contains: q, mode: "insensitive" } },
              { size: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: equipment });
}

export async function POST(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const category = typeof b.category === "string" ? b.category.trim() : "";
  const size = typeof b.size === "string" ? b.size.trim() : null;
  const description = typeof b.description === "string" ? b.description : null;

  const hourlyPriceRaw = b.hourlyPrice;
  const hourlyPrice =
    typeof hourlyPriceRaw === "string" || typeof hourlyPriceRaw === "number"
      ? new Prisma.Decimal(hourlyPriceRaw)
      : null;

  const statusRaw = typeof b.status === "string" ? b.status.trim() : null;
  const status =
    statusRaw && EQUIPMENT_STATUSES.includes(statusRaw as EquipmentStatus)
      ? (statusRaw as EquipmentStatus)
      : undefined;

  if (!category) {
    return NextResponse.json({ error: "category is required." }, { status: 400 });
  }
  if (!hourlyPrice) {
    return NextResponse.json({ error: "hourlyPrice is required." }, { status: 400 });
  }

  const equipment = await prisma.equipment.create({
    data: {
      businessId,
      category,
      size,
      description,
      hourlyPrice,
      ...(status ? { status } : {}),
    },
  });

  return NextResponse.json({ data: equipment }, { status: 201 });
}

