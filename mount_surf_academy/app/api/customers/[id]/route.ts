import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

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

  const customer = await prisma.customer.findFirst({
    where: { id, businessId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
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

  if (typeof b.firstName === "string") data.firstName = b.firstName.trim();
  if (typeof b.lastName === "string") data.lastName = b.lastName.trim();
  if (typeof b.phone === "string") data.phone = b.phone.trim();
  if (b.phone === null) data.phone = null;
  if (typeof b.email === "string") data.email = b.email.trim();
  if (b.email === null) data.email = null;
  if (typeof b.notes === "string") data.notes = b.notes;
  if (b.notes === null) data.notes = null;
  if (b.archivedAt === null) data.archivedAt = null;
  if (typeof b.dob === "string" && b.dob.trim()) {
    const d = new Date(b.dob);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "dob must be a valid date." }, { status: 400 });
    }
    data.dob = d;
  }
  if (b.dob === null) data.dob = null;

  if ("firstName" in data && !(data.firstName as string)) {
    return NextResponse.json({ error: "firstName cannot be empty." }, { status: 400 });
  }
  if ("lastName" in data && !(data.lastName as string)) {
    return NextResponse.json({ error: "lastName cannot be empty." }, { status: 400 });
  }

  const exists = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.customer.update({
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

  const exists = await prisma.customer.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (exists.archivedAt) {
    return NextResponse.json({ ok: true, archived: true });
  }

  const archived = await prisma.customer.update({
    where: { id },
    data: { archivedAt: new Date() },
  });

  return NextResponse.json({ ok: true, archivedAt: archived.archivedAt });
}

