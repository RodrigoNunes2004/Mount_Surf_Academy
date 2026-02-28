import { NextResponse, type NextRequest } from "next/server";
import type { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

const BOOKING_STATUSES = ["BOOKED", "CHECKED_IN", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;

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

  const booking = await prisma.booking.findFirst({
    where: { id, businessId },
  });

  if (!booking) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: booking });
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
  const data: Record<string, unknown> = {};

  const current = await prisma.booking.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      status: true,
      startAt: true,
      endAt: true,
      customerId: true,
    },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (typeof b.customerId === "string") {
    const v = b.customerId.trim();
    if (!v) {
      return NextResponse.json({ error: "customerId cannot be empty." }, { status: 400 });
    }
    const customer = await prisma.customer.findFirst({
      where: { id: v, businessId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { error: "customerId not found for this business." },
        { status: 400 },
      );
    }
    data.customerId = v;
  }

  if (typeof b.lessonId === "string") {
    const v = b.lessonId.trim();
    if (!v) {
      return NextResponse.json(
        { error: "lessonId cannot be empty string (use null to clear)." },
        { status: 400 },
      );
    }
    const lesson = await prisma.lesson.findFirst({
      where: { id: v, businessId },
      select: { id: true },
    });
    if (!lesson) {
      return NextResponse.json(
        { error: "lessonId not found for this business." },
        { status: 400 },
      );
    }
    data.lessonId = v;
  }
  if (b.lessonId === null) data.lessonId = null;

  // Only allow time edits while BOOKED
  const canEditTime = current.status === "BOOKED";

  if (typeof b.startAt === "string" && b.startAt.trim()) {
    if (!canEditTime) {
      return NextResponse.json(
        { error: "Only booked bookings can be rescheduled." },
        { status: 400 },
      );
    }
    const d = new Date(b.startAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "startAt must be a valid date." }, { status: 400 });
    }
    data.startAt = d;
  }
  if (typeof b.endAt === "string" && b.endAt.trim()) {
    if (!canEditTime) {
      return NextResponse.json(
        { error: "Only booked bookings can be rescheduled." },
        { status: 400 },
      );
    }
    const d = new Date(b.endAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
    }
    data.endAt = d;
  }

  if ("startAt" in data || "endAt" in data) {
    const startAt = (data.startAt as Date | undefined) ?? current.startAt;
    const endAt = (data.endAt as Date | undefined) ?? current.endAt;
    if (endAt <= startAt) {
      return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
    }
  }

  // Participants update (lesson bookings only)
  if (typeof b.participants === "number" || typeof b.participants === "string") {
    const n = Math.trunc(Number(b.participants));
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      return NextResponse.json(
        { error: "participants must be an integer between 1 and 100." },
        { status: 400 },
      );
    }
    data.participants = n;
  }

  if (typeof b.status === "string") {
    const s = b.status.trim();
    if (!(BOOKING_STATUSES as readonly string[]).includes(s)) {
      return NextResponse.json(
        { error: `status must be one of: ${BOOKING_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    const next = s;

    // Engine transitions:
    // BOOKED -> CHECKED_IN | CANCELLED | NO_SHOW
    // CHECKED_IN -> COMPLETED
    // Equipment is reserved via BookingEquipmentAllocation at booking time; check-in just updates status.
    if (next === "CHECKED_IN") {
      if (current.status !== "BOOKED") {
        return NextResponse.json(
          { error: "Only booked bookings can be checked in." },
          { status: 400 },
        );
      }
      const booking = await prisma.booking.update({
        where: { id: current.id },
        data: { status: "CHECKED_IN" as BookingStatus },
      });

      return NextResponse.json({ data: booking });
    }

    if (next === "COMPLETED") {
      if (String(current.status) !== "CHECKED_IN") {
        return NextResponse.json(
          { error: "Only checked-in bookings can be completed." },
          { status: 400 },
        );
      }
      data.status = "COMPLETED";
    } else if (next === "CANCELLED") {
      if (current.status !== "BOOKED") {
        return NextResponse.json(
          { error: "Only booked bookings can be cancelled." },
          { status: 400 },
        );
      }
      data.status = "CANCELLED";
    } else if (next === "NO_SHOW") {
      if (current.status !== "BOOKED") {
        return NextResponse.json(
          { error: "Only booked bookings can be marked no-show." },
          { status: 400 },
        );
      }
      data.status = "NO_SHOW";
    } else if (next === "BOOKED") {
      return NextResponse.json(
        { error: "Cannot transition back to BOOKED." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.booking.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  void req;
  void params;
  return NextResponse.json(
    { error: "Bookings cannot be deleted. Use status=CANCELLED instead." },
    { status: 405 },
  );
}

