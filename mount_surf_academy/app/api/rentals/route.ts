import { NextResponse, type NextRequest } from "next/server";
import { EquipmentStatus, RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const RENTAL_STATUSES = Object.values(RentalStatus);

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  const take = Math.min(Math.max(Number(takeRaw ?? 50) || 50, 1), 200);
  const skip = Math.max(Number(skipRaw ?? 0) || 0, 0);

  const customerId = searchParams.get("customerId")?.trim();
  const equipmentId = searchParams.get("equipmentId")?.trim();
  const status = searchParams.get("status")?.trim();

  if (status && !RENTAL_STATUSES.includes(status as RentalStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${RENTAL_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const rentals = await prisma.rental.findMany({
    where: {
      businessId,
      ...(customerId ? { customerId } : {}),
      ...(equipmentId ? { equipmentId } : {}),
      ...(status ? { status: status as RentalStatus } : {}),
    },
    orderBy: { startAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: rentals });
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
  const customerId = typeof b.customerId === "string" ? b.customerId.trim() : "";
  const equipmentId = typeof b.equipmentId === "string" ? b.equipmentId.trim() : "";

  const startAt =
    typeof b.startAt === "string" && b.startAt.trim()
      ? new Date(b.startAt)
      : b.startAt instanceof Date
        ? b.startAt
        : null;
  const endAt =
    typeof b.endAt === "string" && b.endAt.trim()
      ? new Date(b.endAt)
      : b.endAt instanceof Date
        ? b.endAt
        : null;

  const statusRaw = typeof b.status === "string" ? b.status.trim() : null;
  const status =
    statusRaw && RENTAL_STATUSES.includes(statusRaw as RentalStatus)
      ? (statusRaw as RentalStatus)
      : undefined;

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }
  if (!equipmentId) {
    return NextResponse.json({ error: "equipmentId is required." }, { status: 400 });
  }
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "startAt is required and must be a date." }, { status: 400 });
  }
  if (!endAt || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "endAt is required and must be a date." }, { status: 400 });
  }
  if (endAt <= startAt) {
    return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, businessId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json(
      { error: "customerId not found for this business." },
      { status: 400 },
    );
  }

  const now = new Date();
  if (status === RentalStatus.RETURNED) {
    return NextResponse.json(
      { error: "Cannot create a returned rental." },
      { status: 400 },
    );
  }
  if (status === RentalStatus.CANCELLED) {
    return NextResponse.json(
      { error: "Cannot create a cancelled rental." },
      { status: 400 },
    );
  }
  void now;

  let rental;
  try {
    rental = await prisma.$transaction(async (tx) => {
      const eq = await tx.equipment.findFirst({
        where: { id: equipmentId, businessId },
        select: { id: true, status: true },
      });
      if (!eq) throw new Error("equipment_not_found");
      if (eq.status !== EquipmentStatus.AVAILABLE) {
        throw new Error("equipment_not_available");
      }

      const created = await tx.rental.create({
        data: {
          businessId,
          customerId,
          equipmentId,
          startAt,
          endAt,
          ...(status ? { status } : {}),
        },
      });

      await tx.equipment.update({
        where: { id: equipmentId },
        data: { status: EquipmentStatus.RENTED },
      });

      return created;
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "equipment_not_found") {
      return NextResponse.json(
        { error: "equipmentId not found for this business." },
        { status: 400 },
      );
    }
    if (msg === "equipment_not_available") {
      return NextResponse.json(
        { error: "Equipment is not available." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.json({ data: rental }, { status: 201 });
}

