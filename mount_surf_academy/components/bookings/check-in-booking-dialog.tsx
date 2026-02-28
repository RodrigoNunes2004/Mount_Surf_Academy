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
  DialogTrigger,
} from "@/components/ui/dialog";

export function CheckInBookingDialog({
  bookingId,
}: {
  bookingId: string;
  defaultQuantity?: number;
  categories?: { id: string; name: string; totalQuantity?: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkIn() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "CHECKED_IN" }),
    });
    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to check in.");
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Check in</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in</DialogTitle>
          <DialogDescription>
            Mark the booking as checked in. Equipment is already reserved from the booking.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={checkIn} disabled={loading}>
              {loading ? "Checking in..." : "Check in"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

