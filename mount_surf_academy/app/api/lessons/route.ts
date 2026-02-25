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

  const lessons = await prisma.lesson.findMany({
    where: {
      businessId,
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  return NextResponse.json({ data: lessons });
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
  const title = typeof b.title === "string" ? b.title.trim() : "";

  const priceRaw = b.price;
  const price =
    typeof priceRaw === "string" || typeof priceRaw === "number"
      ? new Prisma.Decimal(priceRaw)
      : null;

  const capacityRaw = b.capacity;
  const capacity =
    typeof capacityRaw === "number" && Number.isFinite(capacityRaw)
      ? Math.trunc(capacityRaw)
      : typeof capacityRaw === "string" && capacityRaw.trim()
        ? Math.trunc(Number(capacityRaw))
        : null;

  const instructorId =
    typeof b.instructorId === "string" && b.instructorId.trim()
      ? b.instructorId.trim()
      : null;

  if (!title) {
    return NextResponse.json({ error: "title is required." }, { status: 400 });
  }
  if (!price) {
    return NextResponse.json({ error: "price is required." }, { status: 400 });
  }
  if (capacity !== null && (!Number.isFinite(capacity) || capacity < 0)) {
    return NextResponse.json(
      { error: "capacity must be a non-negative integer." },
      { status: 400 },
    );
  }

  if (instructorId) {
    const instr = await prisma.instructor.findFirst({
      where: { id: instructorId, businessId },
      select: { id: true },
    });
    if (!instr) {
      return NextResponse.json(
        { error: "instructorId not found for this business." },
        { status: 400 },
      );
    }
  }

  const lesson = await prisma.lesson.create({
    data: {
      businessId,
      title,
      price,
      capacity,
      instructorId,
    },
  });

  return NextResponse.json({ data: lesson }, { status: 201 });
}

