import { NextResponse, type NextRequest } from "next/server";
import { EquipmentStatus, RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

const RENTAL_STATUSES = Object.values(RentalStatus);

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

  const rental = await prisma.rental.findFirst({
    where: { id, businessId },
  });

  if (!rental) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: rental });
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
  const now = new Date();

  const current = await prisma.rental.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      equipmentId: true,
      status: true,
      startAt: true,
      endAt: true,
    },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};

  if (typeof b.endAt === "string" && b.endAt.trim()) {
    const d = new Date(b.endAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
    }
    data.endAt = d;
  }

  if ("endAt" in data) {
    const endAt = data.endAt as Date;
    if (endAt <= current.startAt) {
      return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
    }
    if (
      current.status !== RentalStatus.ACTIVE &&
      current.status !== RentalStatus.OVERDUE
    ) {
      return NextResponse.json(
        { error: "Only active rentals can be edited." },
        { status: 400 },
      );
    }
  }

  const statusRequested =
    typeof b.status === "string" ? b.status.trim() : undefined;
  const status =
    statusRequested && RENTAL_STATUSES.includes(statusRequested as RentalStatus)
      ? (statusRequested as RentalStatus)
      : undefined;

  if (statusRequested && !status) {
    return NextResponse.json(
      { error: `status must be one of: ${RENTAL_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  if (status === RentalStatus.RETURNED) {
    if (
      current.status !== RentalStatus.ACTIVE &&
      current.status !== RentalStatus.OVERDUE
    ) {
      return NextResponse.json(
        { error: "Only active rentals can be returned." },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.rental.update({
        where: { id },
        data: {
          status: RentalStatus.RETURNED,
          endAt: now,
          returnedAt: now,
        },
      });
      if (current.equipmentId) {
        await tx.equipment.update({
          where: { id: current.equipmentId },
          data: { status: EquipmentStatus.AVAILABLE },
        });
      }
      return r;
    });

    return NextResponse.json({ data: updated });
  }

  if (status === RentalStatus.CANCELLED) {
    if (current.status !== RentalStatus.ACTIVE) {
      return NextResponse.json(
        { error: "Only active rentals can be cancelled." },
        { status: 400 },
      );
    }
    if (current.startAt <= now) {
      return NextResponse.json(
        { error: "Only rentals that haven't started can be cancelled." },
        { status: 400 },
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const r = await tx.rental.update({
        where: { id },
        data: { status: RentalStatus.CANCELLED },
      });
      if (current.equipmentId) {
        await tx.equipment.update({
          where: { id: current.equipmentId },
          data: { status: EquipmentStatus.AVAILABLE },
        });
      }
      return r;
    });

    return NextResponse.json({ data: updated });
  }

  if (status) {
    return NextResponse.json(
      { error: "Unsupported status transition." },
      { status: 400 },
    );
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No updates provided." }, { status: 400 });
  }

  const updated = await prisma.rental.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  void req;
  void params;
  void id;
  return NextResponse.json(
    { error: "Rentals cannot be deleted." },
    { status: 405 },
  );
}

