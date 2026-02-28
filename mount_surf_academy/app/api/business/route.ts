import { NextResponse, type NextRequest } from "next/server";
import { PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

const ALLOWED_KEYS = [
  "name",
  "location",
  "contactEmail",
  "phone",
  "address",
  "timezone",
  "currency",
  "logoUrl",
  "defaultPaymentMethod",
] as const;

const VALID_PAYMENT_METHODS = Object.values(PaymentMethod);

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: business });
}

export async function PATCH(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const key of ALLOWED_KEYS) {
    const val = body[key];
    if (val === undefined) continue;
    if (key === "defaultPaymentMethod") {
      if (typeof val !== "string" || !VALID_PAYMENT_METHODS.includes(val as PaymentMethod)) {
        return NextResponse.json(
          { error: `defaultPaymentMethod must be one of: ${VALID_PAYMENT_METHODS.join(", ")}` },
          { status: 400 },
        );
      }
      data[key] = val;
    } else if (key === "name" && typeof val === "string") {
      if (!val.trim()) {
        return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
      }
      data[key] = val.trim();
    } else if (
      ["location", "contactEmail", "phone", "address", "timezone", "currency", "logoUrl"].includes(
        key,
      )
    ) {
      data[key] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const business = await prisma.business.update({
    where: { id: businessId },
    data: data as Parameters<typeof prisma.business.update>[0]["data"],
  });

  return NextResponse.json({ data: business });
}

