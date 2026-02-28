import { NextResponse, type NextRequest } from "next/server";
import { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { resolveBusinessId } from "../_lib/tenant";
import { encrypt } from "@/lib/encrypt";

const PROVIDERS = Object.values(IntegrationProvider);

export async function GET(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  const integrations = await prisma.integration.findMany({
    where: { businessId },
    orderBy: { provider: "asc" },
  });

  // Return without raw config (never expose API keys)
  const safe = integrations.map((i) => ({
    id: i.id,
    provider: i.provider,
    isActive: i.isActive,
    lastSyncAt: i.lastSyncAt,
    hasConfig: !!i.config,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }));

  return NextResponse.json({ data: safe });
}

type ConfigPayload = {
  apiKey?: string;
  webhookSecret?: string;
};

export async function PUT(req: NextRequest) {
  const businessId = await resolveBusinessId(req);
  if (!businessId) {
    return NextResponse.json(
      { error: "Missing tenant. Provide x-business-id header." },
      { status: 400 },
    );
  }

  let body: { provider?: string; apiKey?: string; webhookSecret?: string; isActive?: boolean };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const providerRaw = body.provider?.trim()?.toUpperCase();
  if (!providerRaw || !PROVIDERS.includes(providerRaw as IntegrationProvider)) {
    return NextResponse.json(
      { error: `provider must be one of: ${PROVIDERS.join(", ")}` },
      { status: 400 },
    );
  }
  const provider = providerRaw as IntegrationProvider;

  const existing = await prisma.integration.findUnique({
    where: { businessId_provider: { businessId, provider } },
  });

  let merged: ConfigPayload = {};
  if (existing?.config) {
    try {
      const parsed = JSON.parse(existing.config) as ConfigPayload;
      merged = { ...parsed };
    } catch {
      merged = {};
    }
  }
  if (typeof body.apiKey === "string" && body.apiKey.trim()) {
    merged.apiKey = encrypt(body.apiKey.trim());
  }
  if (typeof body.webhookSecret === "string" && body.webhookSecret.trim()) {
    merged.webhookSecret = encrypt(body.webhookSecret.trim());
  }

  const isActive = typeof body.isActive === "boolean" ? body.isActive : true;

  const configJson =
    Object.keys(merged).length > 0 ? JSON.stringify(merged) : existing?.config ?? null;

  const integration = await prisma.integration.upsert({
    where: { businessId_provider: { businessId, provider } },
    create: {
      businessId,
      provider,
      config: configJson,
      isActive,
    },
    update: {
      ...(configJson !== null && { config: configJson }),
      isActive,
    },
  });

  return NextResponse.json({
    data: {
      id: integration.id,
      provider: integration.provider,
      isActive: integration.isActive,
      lastSyncAt: integration.lastSyncAt,
      hasConfig: !!integration.config,
    },
  });
}
