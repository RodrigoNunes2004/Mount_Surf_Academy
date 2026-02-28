import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../../_lib/tenant";

type CategoryDelegate = {
  findFirst: (args?: object) => Promise<unknown | null>;
  update: (args: { where: { id: string }; data: object }) => Promise<unknown>;
  delete: (args: { where: { id: string } }) => Promise<unknown>;
};
const db = prisma as typeof prisma & { equipmentCategory: CategoryDelegate };

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

  const category = await db.equipmentCategory.findFirst({
    where: { id, businessId },
    include: {
      variants: { orderBy: { label: "asc" } },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: category });
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

  const existing = await db.equipmentCategory.findFirst({
    where: { id, businessId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
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

  if (typeof b.name === "string") {
    const v = b.name.trim();
    if (!v) {
      return NextResponse.json({ error: "name cannot be empty." }, { status: 400 });
    }
    const dup = await db.equipmentCategory.findFirst({
      where: { businessId, name: v, id: { not: id } },
    });
    if (dup) {
      return NextResponse.json(
        { error: "A category with this name already exists." },
        { status: 409 },
      );
    }
    data.name = v;
  }

  if (typeof b.trackSizes === "boolean") data.trackSizes = b.trackSizes;

  const category = await db.equipmentCategory.update({
    where: { id },
    data,
  });

  return NextResponse.json({ data: category });
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

  const existing = await db.equipmentCategory.findFirst({
    where: { id, businessId },
    include: { variants: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if ((existing as { variants: unknown[] }).variants.length > 0) {
    return NextResponse.json(
      { error: "Cannot delete category with variants. Delete or reassign variants first." },
      { status: 400 },
    );
  }

  await db.equipmentCategory.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
}
