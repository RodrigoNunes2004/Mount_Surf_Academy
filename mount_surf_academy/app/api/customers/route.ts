import { NextResponse, type NextRequest } from "next/server";
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
  const status = (searchParams.get("status") ?? "active").trim().toLowerCase();
  const sort = (searchParams.get("sort") ?? "newest").trim().toLowerCase();
  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  const take = Math.min(Math.max(Number(takeRaw ?? 20) || 20, 1), 50);
  const skip = Math.max(Number(skipRaw ?? 0) || 0, 0);

  const archivedWhere =
    status === "archived"
      ? { archivedAt: { not: null } }
      : status === "all"
        ? {}
        : { archivedAt: null };

  const where = {
    businessId,
    ...archivedWhere,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "name_asc"
      ? [{ lastName: "asc" as const }, { firstName: "asc" as const }]
      : sort === "name_desc"
        ? [{ lastName: "desc" as const }, { firstName: "desc" as const }]
        : sort === "oldest"
          ? [{ createdAt: "asc" as const }]
          : [{ createdAt: "desc" as const }];

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      take,
      skip,
    }),
  ]);

  return NextResponse.json({
    data: customers,
    meta: { total, take, skip, status, sort, q: q ?? "" },
  });
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
  const notes = typeof b.notes === "string" ? b.notes : null;
  const dob =
    typeof b.dob === "string" && b.dob.trim()
      ? new Date(b.dob)
      : b.dob instanceof Date
        ? b.dob
        : null;

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "firstName and lastName are required." },
      { status: 400 },
    );
  }

  if (dob && Number.isNaN(dob.getTime())) {
    return NextResponse.json({ error: "dob must be a valid date." }, { status: 400 });
  }

  const customer = await prisma.customer.create({
    data: {
      businessId,
      firstName,
      lastName,
      phone,
      email,
      notes,
      dob,
    },
  });

  return NextResponse.json({ data: customer }, { status: 201 });
}

