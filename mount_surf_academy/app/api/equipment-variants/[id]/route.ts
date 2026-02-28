import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";
import { getInUseByVariant } from "@/lib/equipment-availability";

type VariantDelegate = {
  findFirst: (args?: object) => Promise<unknown | null>;
  update: (args: { where: { id: string }; data: object; include?: object }) => Promise<unknown>;
  delete: (args: { where: { id: string }; include?: object }) => Promise<unknown>;
};
const db = prisma as typeof prisma & {
  equipmentVariant: VariantDelegate;
};

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const variant = await db.equipmentVariant.findFirst({
    where: { id, businessId },
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  if (!variant) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const now = new Date();
  const inUseMap = await getInUseByVariant(businessId, [id], now, now);
  const inUse = inUseMap.get(id) ?? 0;
  const availableNow = Math.max(0, (variant as { totalQuantity: number }).totalQuantity - inUse);

  return NextResponse.json({
    data: { ...variant, availableNow, inUse },
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const existing = await db.equipmentVariant.findFirst({
    where: { id, businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
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
  const data: Record<string, unknown> = {};

  if (typeof b.label === "string") {
    const v = b.label.trim();
    if (!v) {
      return NextResponse.json({ error: "label cannot be empty." }, { status: 400 });
    }
    const dup = await db.equipmentVariant.findFirst({
      where: { categoryId: (existing as { categoryId: string }).categoryId, label: v, id: { not: id } },
    });
    if (dup) {
      return NextResponse.json(
        { error: `Variant "${v}" already exists in this category.` },
        { status: 409 },
      );
    }
    data.label = v;
  }

  if (
    typeof b.totalQuantity === "number" &&
    Number.isFinite(b.totalQuantity) &&
    b.totalQuantity >= 0
  ) {
    data.totalQuantity = Math.trunc(b.totalQuantity);
  } else if (typeof b.totalQuantity === "string" && b.totalQuantity.trim()) {
    const n = Math.trunc(Number(b.totalQuantity));
    if (Number.isFinite(n) && n >= 0) data.totalQuantity = n;
  }

  if (typeof b.isActive === "boolean") data.isActive = b.isActive;

  if (
    typeof b.lowStockThreshold === "number" &&
    Number.isFinite(b.lowStockThreshold) &&
    b.lowStockThreshold >= 0
  ) {
    data.lowStockThreshold = Math.trunc(b.lowStockThreshold);
  } else if (typeof b.lowStockThreshold === "string" && b.lowStockThreshold.trim()) {
    const n = Math.trunc(Number(b.lowStockThreshold));
    if (Number.isFinite(n) && n >= 0) data.lowStockThreshold = n;
  }

  const variant = await db.equipmentVariant.update({
    where: { id },
    data,
    include: {
      category: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: variant });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const existing = await db.equipmentVariant.findFirst({
    where: { id, businessId },
    include: {
      _count: { select: { rentals: true, bookingAllocations: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const counts = existing as { _count: { rentals: number; bookingAllocations?: number } };
  if (counts._count.rentals > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete variant with rental history. Deactivate it instead.",
      },
      { status: 400 },
    );
  }
  if ((counts._count.bookingAllocations ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          "Cannot delete variant with booking allocations. Deactivate it instead.",
      },
      { status: 400 },
    );
  }

  await db.equipmentVariant.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
}
