"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Integration = {
  id: string;
  provider: string;
  isActive: boolean;
  lastSyncAt: Date | null;
  hasConfig: boolean;
};

export function IntegrationsSection() {
  const router = useRouter();
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  useEffect(() => {
    fetch("/api/integrations")
      .then((r) => r.json())
      .then((json: { data?: Integration[] }) => setIntegrations(json.data ?? []));
  }, []);
  const [fareharbor, setFareharbor] = useState({ apiKey: "", webhookSecret: "", isActive: true });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const fhIntegration = integrations.find((i) => i.provider === "FAREHARBOR");

  async function saveFareHarbor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/integrations", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "FAREHARBOR",
          apiKey: fareharbor.apiKey.trim() || undefined,
          webhookSecret: fareharbor.webhookSecret.trim() || undefined,
          isActive: fareharbor.isActive,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string; data?: unknown } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to save.");
        return;
      }
      setFareharbor((f) => ({ ...f, apiKey: "", webhookSecret: "" }));
      router.refresh();
      // Refetch integrations
      const listRes = await fetch("/api/integrations");
      const list = (await listRes.json()) as { data?: Integration[] };
      if (list.data) setIntegrations(list.data);
    } finally {
      setLoading(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setError(null);
    try {
      // Placeholder - real FareHarbor test would call their API
      await new Promise((r) => setTimeout(r, 800));
      setError(null);
      alert("Test connection: coming soon. FareHarbor sync will run via background job.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">FareHarbor</h3>
            <p className="text-sm text-muted-foreground">
              Bookings + payments sync from your FareHarbor dashboard. Enter API key and click
              Connect.
            </p>
          </div>
          {fhIntegration?.isActive && fhIntegration.hasConfig ? (
            <Badge variant="default" className="bg-green-600 hover:bg-green-600">
              Connected
            </Badge>
          ) : (
            <Badge variant="secondary">Not connected</Badge>
          )}
        </div>

        {fhIntegration?.lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last sync: {new Date(fhIntegration.lastSyncAt).toLocaleString()}
          </p>
        )}

        <form onSubmit={saveFareHarbor} className="grid gap-4 max-w-md">
          <div className="grid gap-2">
            <Label htmlFor="fh-apiKey">API Key</Label>
            <Input
              id="fh-apiKey"
              type="password"
              placeholder="Paste your FareHarbor API key"
              value={fareharbor.apiKey}
              onChange={(e) => setFareharbor((f) => ({ ...f, apiKey: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="fh-webhook">Webhook Secret (optional)</Label>
            <Input
              id="fh-webhook"
              type="password"
              placeholder="For webhook-based sync"
              value={fareharbor.webhookSecret}
              onChange={(e) => setFareharbor((f) => ({ ...f, webhookSecret: e.target.value }))}
              autoComplete="off"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="fh-active"
              checked={fareharbor.isActive}
              onChange={(e) => setFareharbor((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border"
            />
            <Label htmlFor="fh-active">Active</Label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={loading || !fareharbor.apiKey.trim()}>
              {loading ? "Connecting…" : "Connect / Update"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={testConnection}
              disabled={testing || !fhIntegration?.hasConfig}
            >
              {testing ? "Testing…" : "Test Connection"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-dashed p-4">
        <h3 className="font-medium text-muted-foreground">Stripe</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Coming soon. Direct payments and Stripe Terminal support.
        </p>
      </div>
    </div>
  );
}
