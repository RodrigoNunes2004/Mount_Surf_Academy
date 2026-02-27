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

export function ArchiveCustomerButton({
  customerId,
  disabled,
}: {
  customerId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function archive() {
    setLoading(true);
    await fetch(`/api/customers/${customerId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled || loading}>
          Archive
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive customer?</AlertDialogTitle>
          <AlertDialogDescription>
            This will hide the customer from the active list. You can unarchive
            later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={archive} disabled={loading}>
            {loading ? "Archiving..." : "Archive"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function UnarchiveCustomerButton({
  customerId,
  disabled,
}: {
  customerId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function unarchive() {
    setLoading(true);
    await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archivedAt: null }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={unarchive} disabled={disabled || loading}>
      {loading ? "Unarchiving..." : "Unarchive"}
    </Button>
  );
}

