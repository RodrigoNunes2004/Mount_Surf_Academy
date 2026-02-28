import { NextResponse, type NextRequest } from "next/server";
import { BookingStatus, PaymentMethod } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const BOOKING_STATUSES = Object.values(BookingStatus);
const ACTIVE_LESSON_BOOKING_STATUSES = ["BOOKED", "CHECKED_IN"] as BookingStatus[];
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
  const instructorId = typeof b.instructorId === "string" ? b.instructorId.trim() : null;

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

  if (status && status !== BookingStatus.BOOKED) {
    return NextResponse.json(
      { error: "Bookings must be created with status BOOKED." },
      { status: 400 },
    );
  }

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
    if (!instructorId) {
      return NextResponse.json(
        { error: "instructorId is required for lesson bookings." },
        { status: 400 },
      );
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: lessonId, businessId },
    });
    if (!lesson) {
      return NextResponse.json(
        { error: "lessonId not found for this business." },
        { status: 400 },
      );
    }

    const instructor = await prisma.instructor.findFirst({
      where: { id: instructorId, businessId },
      select: { id: true },
    });
    if (!instructor) {
      return NextResponse.json(
        { error: "instructorId not found for this business." },
        { status: 400 },
      );
    }

    if (lesson.capacity !== null && lesson.capacity !== undefined && participants > lesson.capacity) {
      return NextResponse.json(
        { error: "participants exceeds lesson capacity." },
        { status: 400 },
      );
    }

    const lessonWithDuration = lesson as { durationMinutes?: number };
    const mins = durationMinutes ?? lessonWithDuration.durationMinutes ?? 60;
    const computedEndAt = new Date(startAt.getTime() + mins * 60_000);
    const finalEnd = endAt ?? computedEndAt;
    if (Number.isNaN(finalEnd.getTime())) {
      return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
    }
    if (finalEnd <= startAt) {
      return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
    }

    // Parse equipment allocations (board + wetsuit for V1)
    const allocsRaw = b.equipmentAllocations;
    const equipmentAllocations: { equipmentVariantId: string; quantity: number }[] = [];
    if (Array.isArray(allocsRaw) && allocsRaw.length > 0) {
      for (const a of allocsRaw) {
        if (a && typeof a === "object" && typeof (a as { equipmentVariantId?: string }).equipmentVariantId === "string") {
          const qty = Math.max(1, Math.trunc(Number((a as { quantity?: unknown }).quantity)) || 1);
          equipmentAllocations.push({
            equipmentVariantId: (a as { equipmentVariantId: string }).equipmentVariantId.trim(),
            quantity: qty,
          });
        }
      }
    }
    if (equipmentAllocations.length < 2) {
      return NextResponse.json(
        { error: "Lesson requires board and wetsuit allocation (2 equipment variants)." },
        { status: 400 },
      );
    }

    const methodRaw = typeof b.paymentMethod === "string" ? b.paymentMethod.trim() : "";
    const method = methodRaw && PAYMENT_METHODS.includes(methodRaw as PaymentMethod)
      ? (methodRaw as PaymentMethod)
      : PaymentMethod.CASH;

    const lessonPrice = (lesson as { price: Prisma.Decimal }).price;
    const amount = new Prisma.Decimal(participants).mul(lessonPrice);

    // Prevent overbooking based on lesson capacity
    if (lesson.capacity !== null && lesson.capacity !== undefined) {
      const overlap = (await prisma.booking.aggregate({
        where: {
          businessId,
          lessonId,
          status: { in: ACTIVE_LESSON_BOOKING_STATUSES },
          startAt: { lt: finalEnd },
          endAt: { gt: startAt },
        },
        _sum: { participants: true } as never,
      })) as unknown as { _sum: { participants: number | null } };
      const alreadyBooked = Number(overlap._sum?.participants ?? 0);
      if (alreadyBooked + participants > lesson.capacity) {
        return NextResponse.json(
          { error: "Lesson is fully booked for this time slot." },
          { status: 409 },
        );
      }
    }

    // Prevent double-booking instructor (startAt < existing.endAt AND endAt > existing.startAt)
    const instructorOverlap = await prisma.booking.findFirst({
      where: {
        businessId,
        ...(instructorId ? { instructorId } : {}),
        status: { in: ACTIVE_LESSON_BOOKING_STATUSES },
        startAt: { lt: finalEnd },
        endAt: { gt: startAt },
      } as never,
    });
    if (instructorOverlap) {
      return NextResponse.json(
        { error: "Instructor is already booked for this time slot." },
        { status: 409 },
      );
    }

    try {
      const booking = await prisma.$transaction(async (tx) => {
        const db = tx as Record<string, unknown>;
        // Validate equipment availability for each allocation
        for (const alloc of equipmentAllocations) {
          const variant = await (db.equipmentVariant as { findFirst: (args: unknown) => Promise<{ totalQuantity: number } | null> }).findFirst({
            where: { id: alloc.equipmentVariantId, businessId },
            select: { totalQuantity: true },
          });
          if (!variant) throw new Error("variant_not_found");

          const [rentalOverlap, allocOverlap] = await Promise.all([
            (db.rental as { aggregate: (args: unknown) => Promise<{ _sum: { quantity: number | null } }> }).aggregate({
              where: {
                businessId,
                equipmentVariantId: alloc.equipmentVariantId,
                status: { in: ["ACTIVE", "OVERDUE"] },
                startAt: { lt: finalEnd },
                endAt: { gt: startAt },
              },
              _sum: { quantity: true },
            }),
            (db.bookingEquipmentAllocation as { aggregate: (args: unknown) => Promise<{ _sum: { quantity: number | null } }> }).aggregate({
              where: {
                equipmentVariantId: alloc.equipmentVariantId,
                booking: {
                  businessId,
                  status: { in: ["BOOKED", "CHECKED_IN"] },
                  startAt: { lt: finalEnd },
                  endAt: { gt: startAt },
                },
              },
              _sum: { quantity: true },
            }),
          ]);
          const inUse = (rentalOverlap._sum.quantity ?? 0) + (allocOverlap._sum.quantity ?? 0);
          const available = variant.totalQuantity - inUse;
          if (available < alloc.quantity) {
            throw new Error("insufficient_equipment");
          }
        }

        type BookingCreateResult = Awaited<ReturnType<typeof prisma.booking.create>>;
        const created = await (db.booking as { create: (args: { data: unknown }) => Promise<BookingCreateResult> }).create({
          data: {
            businessId,
            customerId,
            instructorId,
            lessonId,
            startAt,
            endAt: finalEnd,
            participants,
            ...(status ? { status } : {}),
          },
        });

        for (const alloc of equipmentAllocations) {
          await (db.bookingEquipmentAllocation as { create: (args: unknown) => Promise<unknown> }).create({
            data: {
              bookingId: created.id,
              equipmentVariantId: alloc.equipmentVariantId,
              quantity: alloc.quantity,
            },
          });
        }

        await (db.payment as { create: (args: unknown) => Promise<unknown> }).create({
          data: {
            businessId,
            bookingId: created.id,
            amount,
            method,
          },
        });

        return created;
      });

      return NextResponse.json({ data: booking }, { status: 201 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === "variant_not_found") {
        return NextResponse.json(
          { error: "One or more equipment variants not found." },
          { status: 400 },
        );
      }
      if (msg === "insufficient_equipment") {
        return NextResponse.json(
          { error: "Not enough equipment available for this time window. Try different sizes or times." },
          { status: 409 },
        );
      }
      throw e;
    }
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
    } as Parameters<typeof prisma.booking.create>[0]["data"],
  });

  return NextResponse.json({ data: booking }, { status: 201 });
}

