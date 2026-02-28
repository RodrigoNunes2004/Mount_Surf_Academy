import { NextResponse, type NextRequest } from "next/server";
import { RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

type VariantDelegate = {
  findMany: (args?: object) => Promise<unknown[]>;
  findFirst: (args?: object) => Promise<unknown | null>;
  create: (args: { data: object; include?: object }) => Promise<unknown>;
};
type CategoryDelegate = {
  findFirst: (args?: object) => Promise<unknown | null>;
};
type RentalDelegate = {
  findMany: (args?: object) => Promise<{ equipmentVariantId: string | null; quantity: number }[]>;
};
const db = prisma as typeof prisma & {
  equipmentVariant: VariantDelegate;
  equipmentCategory: CategoryDelegate;
  rental: RentalDelegate;
};

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId")?.trim();

  const variants = await db.equipmentVariant.findMany({
    where: {
      businessId,
      ...(categoryId ? { categoryId } : {}),
    },
    orderBy: [{ category: { name: "asc" } }, { label: "asc" }],
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  const variantIds = (variants as { id: string }[]).map((v) => v.id);
  const activeStatuses = [RentalStatus.ACTIVE, RentalStatus.OVERDUE].filter(
    Boolean,
  ) as RentalStatus[];

  const inUseMap = new Map<string, number>();
  if (variantIds.length > 0) {
    const rentals = await db.rental.findMany({
      where: {
        businessId,
        equipmentVariantId: { in: variantIds },
        status: { in: activeStatuses },
      },
      select: { equipmentVariantId: true, quantity: true },
    });
    for (const r of rentals) {
      if (r.equipmentVariantId) {
        inUseMap.set(r.equipmentVariantId, (inUseMap.get(r.equipmentVariantId) ?? 0) + r.quantity);
      }
    }
  }

  const data = (variants as { id: string; totalQuantity: number }[]).map((v) => {
    const inUse = inUseMap.get(v.id) ?? 0;
    const available = Math.max(0, v.totalQuantity - inUse);
    return {
      ...(v as object),
      availableNow: available,
      inUse,
    };
  });

  return NextResponse.json({ data });
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
  const categoryId = typeof b.categoryId === "string" ? b.categoryId.trim() : "";
  const label = typeof b.label === "string" ? b.label.trim() : "";
  const totalQuantity =
    typeof b.totalQuantity === "number" && Number.isFinite(b.totalQuantity)
      ? Math.max(0, Math.trunc(b.totalQuantity))
      : typeof b.totalQuantity === "string" && b.totalQuantity.trim()
        ? Math.max(0, Math.trunc(Number(b.totalQuantity)) || 0)
        : 0;
  const isActive =
    typeof b.isActive === "boolean"
      ? b.isActive
      : typeof b.isActive === "string"
        ? b.isActive.toLowerCase() !== "false"
        : true;

  if (!categoryId) {
    return NextResponse.json({ error: "categoryId is required." }, { status: 400 });
  }
  if (!label) {
    return NextResponse.json({ error: "label is required." }, { status: 400 });
  }

  const category = await db.equipmentCategory.findFirst({
    where: { id: categoryId, businessId },
  });
  if (!category) {
    return NextResponse.json(
      { error: "Category not found for this business." },
      { status: 400 },
    );
  }

  const existing = await db.equipmentVariant.findFirst({
    where: { categoryId, label },
  });
  if (existing) {
    return NextResponse.json(
      { error: `Variant "${label}" already exists in this category.` },
      { status: 409 },
    );
  }

  const variant = await db.equipmentVariant.create({
    data: {
      businessId,
      categoryId,
      label,
      totalQuantity,
      isActive,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: variant }, { status: 201 });
}
