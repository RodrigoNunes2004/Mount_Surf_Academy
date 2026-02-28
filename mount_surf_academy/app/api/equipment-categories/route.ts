import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

type CategoryDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  findFirst: (args?: object) => Promise<unknown | null>;
  create: (args: { data: object }) => Promise<unknown>;
};
const db = prisma as typeof prisma & { equipmentCategory: CategoryDelegate };

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const categories = await db.equipmentCategory.findMany({
    where: { businessId },
    orderBy: { name: "asc" },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { label: "asc" },
        select: { id: true, label: true, totalQuantity: true },
      },
    },
  });

  return NextResponse.json({ data: categories });
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
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const trackSizes =
    typeof b.trackSizes === "boolean"
      ? b.trackSizes
      : typeof b.trackSizes === "string"
        ? b.trackSizes.toLowerCase() === "true"
        : true;

  if (!name) {
    return NextResponse.json({ error: "name is required." }, { status: 400 });
  }

  const existing = await db.equipmentCategory.findFirst({
    where: { businessId, name },
  });
  if (existing) {
    return NextResponse.json(
      { error: "A category with this name already exists." },
      { status: 409 },
    );
  }

  const category = await db.equipmentCategory.create({
    data: {
      businessId,
      name,
      trackSizes,
    },
  });

  return NextResponse.json({ data: category }, { status: 201 });
}
