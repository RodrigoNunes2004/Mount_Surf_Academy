import { NextResponse, type NextRequest } from "next/server";
import { EquipmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

const EQUIPMENT_STATUSES = Object.values(EquipmentStatus);

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const equipment = await prisma.equipment.findFirst({
    where: { id, businessId },
  });

  if (!equipment) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: equipment });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = resolveBusinessId(req);
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
  const data: Record<string, unknown> = {};

  if (typeof b.category === "string") data.category = b.category.trim();
  if (typeof b.size === "string") data.size = b.size.trim();
  if (b.size === null) data.size = null;
  if (typeof b.description === "string") data.description = b.description;
  if (b.description === null) data.description = null;

  if (typeof b.hourlyPrice === "string" || typeof b.hourlyPrice === "number") {
    data.hourlyPrice = new Prisma.Decimal(b.hourlyPrice);
  }

  if (typeof b.status === "string") {
    const s = b.status.trim();
    if (!EQUIPMENT_STATUSES.includes(s as EquipmentStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${EQUIPMENT_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = s as EquipmentStatus;
  }

  if ("category" in data && !(data.category as string)) {
    return NextResponse.json({ error: "category cannot be empty." }, { status: 400 });
  }

  const exists = await prisma.equipment.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.equipment.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const businessId = resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const exists = await prisma.equipment.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.equipment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

