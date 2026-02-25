import { NextResponse, type NextRequest } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

const BOOKING_STATUSES = Object.values(BookingStatus);

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

  if (typeof b.startAt === "string" && b.startAt.trim()) {
    const d = new Date(b.startAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "startAt must be a valid date." }, { status: 400 });
    }
    data.startAt = d;
  }
  if (typeof b.endAt === "string" && b.endAt.trim()) {
    const d = new Date(b.endAt);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "endAt must be a valid date." }, { status: 400 });
    }
    data.endAt = d;
  }

  if ("startAt" in data || "endAt" in data) {
    const current = await prisma.booking.findFirst({
      where: { id, businessId },
      select: { startAt: true, endAt: true },
    });
    if (!current) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    const startAt = (data.startAt as Date | undefined) ?? current.startAt;
    const endAt = (data.endAt as Date | undefined) ?? current.endAt;
    if (endAt <= startAt) {
      return NextResponse.json({ error: "endAt must be after startAt." }, { status: 400 });
    }
  }

  if (typeof b.status === "string") {
    const s = b.status.trim();
    if (!BOOKING_STATUSES.includes(s as BookingStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${BOOKING_STATUSES.join(", ")}` },
        { status: 400 },
      );
    }
    data.status = s as BookingStatus;
  }

  const exists = await prisma.booking.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.booking.update({
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

  const exists = await prisma.booking.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

