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
  const takeRaw = searchParams.get("take");
  const skipRaw = searchParams.get("skip");
  const take = Math.min(Math.max(Number(takeRaw ?? 50) || 50, 1), 200);
  const skip = Math.max(Number(skipRaw ?? 0) || 0, 0);

  const users = await prisma.user.findMany({
    where: { businessId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
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

  return NextResponse.json({ data: users });
}

export async function POST() {
  return NextResponse.json(
    { error: "Not implemented. Create users via auth/admin flow." },
    { status: 501 },
  );
}

