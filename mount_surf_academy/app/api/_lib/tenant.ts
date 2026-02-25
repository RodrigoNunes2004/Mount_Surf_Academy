import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function resolveBusinessId(req: NextRequest): Promise<string | null> {
  const session = await getServerSession(authOptions);
  const fromSession = session?.user?.businessId?.trim();
  if (fromSession) return fromSession;

  const header = req.headers.get("x-business-id")?.trim();
  if (header && process.env.NODE_ENV !== "production") return header;

  const env = process.env.DEFAULT_BUSINESS_ID?.trim();
  if (env && process.env.NODE_ENV !== "production") return env;

  if (process.env.NODE_ENV !== "production") return "seed_business";

  return null;
}

