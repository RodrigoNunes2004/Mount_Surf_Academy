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

  const user = await prisma.user.findFirst({
    where: { id, businessId },
    select: {
      id: true,
      businessId: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PATCH() {
  return NextResponse.json(
    { error: "Not implemented. Update users via auth/admin flow." },
    { status: 501 },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Not implemented. Delete users via auth/admin flow." },
    { status: 501 },
  );
}

