import { NextResponse, type NextRequest } from "next/server";
import { EquipmentStatus, PaymentMethod, RentalStatus } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const RENTAL_STATUSES = Object.values(RentalStatus);
const PAYMENT_METHODS = Object.values(PaymentMethod);

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
  const equipmentVariantId = typeof b.equipmentVariantId === "string" ? b.equipmentVariantId.trim() : "";

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

  const quantity =
    typeof b.quantity === "number" && Number.isFinite(b.quantity)
      ? Math.max(1, Math.trunc(b.quantity))
      : typeof b.quantity === "string"
        ? Math.max(1, Math.trunc(Number(b.quantity)) || 1)
        : 1;

  const priceTotalRaw = b.priceTotal;
  const priceTotal =
    typeof priceTotalRaw === "number" && Number.isFinite(priceTotalRaw) && priceTotalRaw >= 0
      ? new Prisma.Decimal(priceTotalRaw)
      : typeof priceTotalRaw === "string" && priceTotalRaw.trim()
        ? new Prisma.Decimal(priceTotalRaw)
        : null;

  const methodRaw = typeof b.method === "string" ? b.method.trim() : "";
  const method =
    methodRaw && PAYMENT_METHODS.includes(methodRaw as PaymentMethod)
      ? (methodRaw as PaymentMethod)
      : null;

  const statusRaw = typeof b.status === "string" ? b.status.trim() : null;
  const status =
    statusRaw && RENTAL_STATUSES.includes(statusRaw as RentalStatus)
      ? (statusRaw as RentalStatus)
      : undefined;

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }
  if (!equipmentId && !equipmentVariantId) {
    return NextResponse.json(
      { error: "equipmentId or equipmentVariantId is required." },
      { status: 400 },
    );
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

  const activeStatuses = [RentalStatus.ACTIVE, RentalStatus.OVERDUE].filter(Boolean) as RentalStatus[];

  if (equipmentVariantId) {
    if (!priceTotal || priceTotal.lte(0)) {
      return NextResponse.json(
        { error: "priceTotal is required and must be positive for variant rentals." },
        { status: 400 },
      );
    }
    if (!method) {
      return NextResponse.json(
        { error: "method is required (CASH, CARD, TRANSFER, ONLINE)." },
        { status: 400 },
      );
    }

    try {
      const rental = await prisma.$transaction(async (tx) => {
        const variant = await tx.equipmentVariant.findFirst({
          where: { id: equipmentVariantId, businessId },
          select: { id: true, totalQuantity: true },
        });
        if (!variant) throw new Error("variant_not_found");

        const [rentalOverlap, allocationOverlap] = await Promise.all([
          tx.rental.aggregate({
            where: {
              businessId,
              equipmentVariantId,
              status: { in: activeStatuses },
              startAt: { lt: endAt },
              endAt: { gt: startAt },
            },
            _sum: { quantity: true },
          }),
          tx.bookingEquipmentAllocation.aggregate({
            where: {
              equipmentVariantId,
              booking: {
                businessId,
                status: { in: ["BOOKED", "CHECKED_IN"] },
                startAt: { lt: endAt },
                endAt: { gt: startAt },
              },
            },
            _sum: { quantity: true },
          }),
        ]);
        const inUse = (rentalOverlap._sum.quantity ?? 0) + (allocationOverlap._sum.quantity ?? 0);
        const available = variant.totalQuantity - inUse;
        if (available < quantity) {
          throw new Error("insufficient_availability");
        }

        const created = await tx.rental.create({
          data: {
            businessId,
            customerId,
            equipmentVariantId,
            quantity,
            startAt,
            endAt,
            priceTotal,
            status: RentalStatus.ACTIVE,
          },
        });

        await tx.payment.create({
          data: {
            businessId,
            rentalId: created.id,
            amount: priceTotal,
            method,
          },
        });

        return created;
      });

      return NextResponse.json({ data: rental }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "variant_not_found") {
        return NextResponse.json(
          { error: "equipmentVariantId not found for this business." },
          { status: 400 },
        );
      }
      if (msg === "insufficient_availability") {
        return NextResponse.json(
          { error: "Not enough equipment available for this time window." },
          { status: 409 },
        );
      }
      throw e;
    }
  }

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

