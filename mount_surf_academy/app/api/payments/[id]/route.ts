import { NextResponse, type NextRequest } from "next/server";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

const PAYMENT_METHODS = Object.values(PaymentMethod);

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

  const payment = await prisma.payment.findFirst({
    where: { id, businessId },
  });

  if (!payment) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: payment });
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

  if (typeof b.amount === "string" || typeof b.amount === "number") {
    data.amount = new Prisma.Decimal(b.amount);
  }

  if (typeof b.method === "string") {
    const m = b.method.trim();
    if (!PAYMENT_METHODS.includes(m as PaymentMethod)) {
      return NextResponse.json(
        { error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` },
        { status: 400 },
      );
    }
    data.method = m as PaymentMethod;
  }

  if (typeof b.stripeId === "string") data.stripeId = b.stripeId.trim();
  if (b.stripeId === null) data.stripeId = null;

  if (typeof b.bookingId === "string") {
    const v = b.bookingId.trim();
    if (!v) {
      return NextResponse.json(
        { error: "bookingId cannot be empty string (use null to clear)." },
        { status: 400 },
      );
    }
    const booking = await prisma.booking.findFirst({
      where: { id: v, businessId },
      select: { id: true },
    });
    if (!booking) {
      return NextResponse.json(
        { error: "bookingId not found for this business." },
        { status: 400 },
      );
    }
    data.bookingId = v;
  }
  if (b.bookingId === null) data.bookingId = null;

  if (typeof b.rentalId === "string") {
    const v = b.rentalId.trim();
    if (!v) {
      return NextResponse.json(
        { error: "rentalId cannot be empty string (use null to clear)." },
        { status: 400 },
      );
    }
    const rental = await prisma.rental.findFirst({
      where: { id: v, businessId },
      select: { id: true },
    });
    if (!rental) {
      return NextResponse.json(
        { error: "rentalId not found for this business." },
        { status: 400 },
      );
    }
    data.rentalId = v;
  }
  if (b.rentalId === null) data.rentalId = null;

  const exists = await prisma.payment.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const current = await prisma.payment.findFirst({
    where: { id, businessId },
    select: { bookingId: true, rentalId: true },
  });
  if (!current) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const bookingId = ("bookingId" in data ? (data.bookingId as string | null) : current.bookingId) ?? null;
  const rentalId = ("rentalId" in data ? (data.rentalId as string | null) : current.rentalId) ?? null;
  if (!bookingId && !rentalId) {
    return NextResponse.json(
      { error: "Payment must be linked to either bookingId or rentalId." },
      { status: 400 },
    );
  }
  if (bookingId && rentalId) {
    return NextResponse.json(
      { error: "Payment cannot be linked to both bookingId and rentalId." },
      { status: 400 },
    );
  }

  const updated = await prisma.payment.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: updated });
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

  const exists = await prisma.payment.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.payment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

