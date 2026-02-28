import { NextResponse, type NextRequest } from "next/server";
import { PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

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

  const bookingId = searchParams.get("bookingId")?.trim();
  const rentalId = searchParams.get("rentalId")?.trim();
  const method = searchParams.get("method")?.trim();

  if (method && !PAYMENT_METHODS.includes(method as PaymentMethod)) {
    return NextResponse.json(
      { error: `method must be one of: ${PAYMENT_METHODS.join(", ")}` },
      { status: 400 },
    );
  }

  const payments = await prisma.payment.findMany({
    where: {
      businessId,
      ...(bookingId ? { bookingId } : {}),
      ...(rentalId ? { rentalId } : {}),
      ...(method ? { method: method as PaymentMethod } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: payments });
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

  const amountRaw = b.amount;
  const amount =
    typeof amountRaw === "string" || typeof amountRaw === "number"
      ? new Prisma.Decimal(amountRaw)
      : null;

  const methodRaw = typeof b.method === "string" ? b.method.trim() : "";
  const method = PAYMENT_METHODS.includes(methodRaw as PaymentMethod)
    ? (methodRaw as PaymentMethod)
    : null;

  const stripePaymentIntentId = typeof b.stripePaymentIntentId === "string" ? b.stripePaymentIntentId.trim() : null;
  const stripeSessionId = typeof b.stripeSessionId === "string" ? b.stripeSessionId.trim() : null;

  const bookingId = typeof b.bookingId === "string" ? b.bookingId.trim() : null;
  const rentalId = typeof b.rentalId === "string" ? b.rentalId.trim() : null;

  if (!amount) {
    return NextResponse.json({ error: "amount is required." }, { status: 400 });
  }
  if (!method) {
    return NextResponse.json(
      { error: `method is required and must be one of: ${PAYMENT_METHODS.join(", ")}` },
      { status: 400 },
    );
  }
  if (!bookingId && !rentalId) {
    return NextResponse.json(
      { error: "Either bookingId or rentalId is required." },
      { status: 400 },
    );
  }
  if (bookingId && rentalId) {
    return NextResponse.json(
      { error: "Provide either bookingId or rentalId (not both)." },
      { status: 400 },
    );
  }

  if (bookingId) {
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, businessId },
      select: { id: true },
    });
    if (!booking) {
      return NextResponse.json(
        { error: "bookingId not found for this business." },
        { status: 400 },
      );
    }
  }

  if (rentalId) {
    const rental = await prisma.rental.findFirst({
      where: { id: rentalId, businessId },
      select: { id: true },
    });
    if (!rental) {
      return NextResponse.json(
        { error: "rentalId not found for this business." },
        { status: 400 },
      );
    }
  }

  const payment = await prisma.payment.create({
    data: {
      businessId,
      amount,
      method,
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
      ...(stripeSessionId ? { stripeSessionId } : {}),
      bookingId: bookingId || null,
      rentalId: rentalId || null,
    },
  });

  return NextResponse.json({ data: payment }, { status: 201 });
}

