"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "EFTPOS", label: "EFTPOS" },
  { value: "CARD", label: "Card" },
  { value: "ONLINE", label: "Online" },
] as const;

type Business = {
  id: string;
  defaultPaymentMethod?: string | null;
};

export function PaymentSettingsForm({ business }: { business: Business }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defaultMethod, setDefaultMethod] = useState<string>(
    business.defaultPaymentMethod ?? "CASH"
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/business", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ defaultPaymentMethod: defaultMethod }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to save.");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 max-w-xl">
      {error && (
        <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
          {error}
        </div>
      )}
      <div className="grid gap-2">
        <Label>Default payment method</Label>
        <p className="text-sm text-muted-foreground">
          Used when recording a payment manually (rentals, lessons).
        </p>
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <input
                type="radio"
                name="defaultMethod"
                value={value}
                checked={defaultMethod === value}
                onChange={() => setDefaultMethod(value)}
                className="sr-only"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
