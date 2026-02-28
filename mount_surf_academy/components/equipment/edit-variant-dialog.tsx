"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VariantRow = {
  id: string;
  label: string;
  totalQuantity: number;
  lowStockThreshold?: number;
  availableNow: number;
  inUse: number;
  category: { id: string; name: string };
};

type EditVariantDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant: VariantRow | null;
};

export function EditVariantDialog({
  open,
  onOpenChange,
  variant,
}: EditVariantDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalQuantity, setTotalQuantity] = useState(() =>
    variant ? String(variant.totalQuantity) : "0",
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(() =>
    variant ? String(variant.lowStockThreshold ?? 2) : "2",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!variant) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/equipment-variants/${variant.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        totalQuantity: Math.max(0, Math.trunc(Number(totalQuantity)) || 0),
        lowStockThreshold: Math.max(0, Math.trunc(Number(lowStockThreshold)) ?? 2),
      }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(payload?.error ?? "Failed to update.");
      return;
    }

    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit quantity</DialogTitle>
          <DialogDescription>
            {variant
              ? `${variant.category.name} ${variant.label} — adjust total quantity when you buy or retire equipment.`
              : ""}
          </DialogDescription>
        </DialogHeader>
        {variant ? (
          <form onSubmit={onSubmit} className="grid gap-4">
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              Total: {variant.totalQuantity} · Available now:{" "}
              {variant.availableNow} · In use: {variant.inUse}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-qty">New total quantity</Label>
              <Input
                id="edit-qty"
                type="number"
                min={0}
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-threshold">Low stock threshold</Label>
              <Input
                id="edit-threshold"
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                title="Show warning when available drops below this"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
