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

  const instructor = await prisma.instructor.findFirst({
    where: { id, businessId },
  });

  if (!instructor) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: instructor });
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

  if ("firstName" in data && !(data.firstName as string)) {
    return NextResponse.json({ error: "firstName cannot be empty." }, { status: 400 });
  }
  if ("lastName" in data && !(data.lastName as string)) {
    return NextResponse.json({ error: "lastName cannot be empty." }, { status: 400 });
  }

  const exists = await prisma.instructor.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.instructor.update({
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

  const exists = await prisma.instructor.findFirst({ where: { id, businessId } });
  if (!exists) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.instructor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

