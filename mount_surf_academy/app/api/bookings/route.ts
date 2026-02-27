import { NextResponse, type NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const BOOKING_STATUSES = Object.values(BookingStatus);

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
  const lessonId = searchParams.get("lessonId")?.trim();
  const status = searchParams.get("status")?.trim();

  if (status && !BOOKING_STATUSES.includes(status as BookingStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${BOOKING_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const bookings = await prisma.booking.findMany({
    where: {
      businessId,
      ...(customerId ? { customerId } : {}),
      ...(lessonId ? { lessonId } : {}),
      ...(status ? { status: status as BookingStatus } : {}),
    },
    orderBy: { startAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: bookings });
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
  const lessonId = typeof b.lessonId === "string" ? b.lessonId.trim() : null;

  const startAt =
    typeof b.startAt === "string" && b.startAt.trim()
      ? new Date(b.startAt)
      : b.startAt instanceof Date
        ? b.startAt
        : null;
  const participantsRaw = b.participants;
  const participants =
    typeof participantsRaw === "number" && Number.isFinite(participantsRaw)
      ? Math.trunc(participantsRaw)
      : typeof participantsRaw === "string" && participantsRaw.trim()
        ? Math.trunc(Number(participantsRaw))
        : 1;

  const durationMinutesRaw = b.durationMinutes;
  const durationMinutes =
    typeof durationMinutesRaw === "number" && Number.isFinite(durationMinutesRaw)
      ? Math.trunc(durationMinutesRaw)
      : typeof durationMinutesRaw === "string" && durationMinutesRaw.trim()
        ? Math.trunc(Number(durationMinutesRaw))
        : null;

  const endAt =
    typeof b.endAt === "string" && b.endAt.trim()
      ? new Date(b.endAt)
      : b.endAt instanceof Date
        ? b.endAt
        : null;

  const statusRaw = typeof b.status === "string" ? b.status.trim() : null;
  const status =
    statusRaw && BOOKING_STATUSES.includes(statusRaw as BookingStatus)
      ? (statusRaw as BookingStatus)
      : undefined;

  if (!customerId) {
    return NextResponse.json({ error: "customerId is required." }, { status: 400 });
  }
  if (!startAt || Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "startAt is required and must be a date." }, { status: 400 });
  }
  if (!Number.isFinite(participants) || participants < 1 || participants > 100) {
    return NextResponse.json(
      { error: "participants must be an integer between 1 and 100." },
      { status: 400 },
    );
  }
  if (durationMinutes !== null && (!Number.isFinite(durationMinutes) || durationMinutes < 15 || durationMinutes > 24 * 60)) {
    return NextResponse.json(
      { error: "durationMinutes must be between 15 and 1440." },
      { status: 400 },
    );
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

  if (lessonId) {
    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, businessId },
      select: { id: true, capacity: true, durationMinutes: true },
    });
    if (!lesson) {
      return NextResponse.json(
        { error: "lessonId not found for this business." },
        { status: 400 },
      );
    }

    if (lesson.capacity !== null && lesson.capacity !== undefined && participants > lesson.capacity) {
      return NextResponse.json(
        { error: "participants exceeds lesson capacity." },
        { status: 400 },
      );
    }

    const mins = durationMinutes ?? lesson.durationMinutes ?? 60;
    const computedEndAt = new Date(startAt.getTime() + mins * 60_000);
    if (!endAt) {
      // use computed
      // eslint-disable-next-line no-param-reassign
      (b as Record<string, unknown>).endAt = computedEndAt;
    } else if (Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
    }

    const finalEnd = (b.endAt as Date) ?? computedEndAt;
    if (finalEnd <= startAt) {
      return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
    }

    const booking = await prisma.booking.create({
      data: {
        businessId,
        customerId,
        lessonId,
        startAt,
        endAt: finalEnd,
        participants,
        ...(status ? { status } : {}),
      },
    });

    return NextResponse.json({ data: booking }, { status: 201 });
  }

  if (!endAt || Number.isNaN(endAt.getTime())) {
    return NextResponse.json({ error: "endAt is required and must be a date." }, { status: 400 });
  }
  if (endAt <= startAt) {
    return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
  }

  const booking = await prisma.booking.create({
    data: {
      businessId,
      customerId,
      lessonId: null,
      startAt,
      endAt,
      participants,
      ...(status ? { status } : {}),
    },
  });

  return NextResponse.json({ data: booking }, { status: 201 });
}

