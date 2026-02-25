import type { NextRequest } from "next/server";

export function resolveBusinessId(req: NextRequest): string | null {
  const header = req.headers.get("x-business-id")?.trim();
  if (header) return header;

  const env = process.env.DEFAULT_BUSINESS_ID?.trim();
  if (env) return env;

  if (process.env.NODE_ENV !== "production") return "seed_business";

  return null;
}

