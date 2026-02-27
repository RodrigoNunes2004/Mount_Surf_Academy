"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function ReturnRentalButton({ rentalId }: { rentalId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function markReturned() {
    setLoading(true);
    await fetch(`/api/rentals/${rentalId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "RETURNED" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="secondary" disabled={loading}>
          Return
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Mark as returned?</AlertDialogTitle>
          <AlertDialogDescription>
            This will set the rental status to returned and free up the equipment.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={markReturned} disabled={loading}>
            {loading ? "Saving..." : "Mark returned"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function CancelRentalButton({
  rentalId,
  disabled,
}: {
  rentalId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function cancel() {
    setLoading(true);
    await fetch(`/api/rentals/${rentalId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" disabled={disabled || loading}>
          Cancel
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel rental?</AlertDialogTitle>
          <AlertDialogDescription>
            This keeps the rental history but marks it as cancelled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Back</AlertDialogCancel>
          <AlertDialogAction onClick={cancel} disabled={loading}>
            {loading ? "Cancelling..." : "Cancel rental"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

