import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  const take = Math.min(Math.max(Number(takeRaw ?? 50) || 50, 1), 200);
  const skip = Math.max(Number(skipRaw ?? 0) || 0, 0);

  const activeOnly = searchParams.get("active") === "true";

  const instructors = await prisma.instructor.findMany({
    where: {
      businessId,
      ...(activeOnly ? { isActive: true } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: instructors });
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
  const firstName = typeof b.firstName === "string" ? b.firstName.trim() : "";
  const lastName = typeof b.lastName === "string" ? b.lastName.trim() : "";
  const phone = typeof b.phone === "string" ? b.phone.trim() : null;
  const email = typeof b.email === "string" ? b.email.trim() : null;
  const isActive = typeof b.isActive === "boolean" ? b.isActive : true;

  let hourlyRate: Prisma.Decimal | undefined;
  if (typeof b.hourlyRate === "number" && b.hourlyRate >= 0) {
    hourlyRate = new Prisma.Decimal(b.hourlyRate);
  } else if (typeof b.hourlyRate === "string" && b.hourlyRate.trim()) {
    const n = Number(b.hourlyRate);
    if (Number.isFinite(n) && n >= 0) hourlyRate = new Prisma.Decimal(n);
  }

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are required." },
      { status: 400 },
    );
  }

  const instructor = await prisma.instructor.create({
    data: {
      businessId,
      firstName,
      lastName,
      phone,
      email,
      ...(hourlyRate !== undefined && { hourlyRate }),
      isActive,
    },
  });

  return NextResponse.json({ data: instructor }, { status: 201 });
}

