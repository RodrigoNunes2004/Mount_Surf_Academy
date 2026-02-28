"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { EditVariantDialog } from "./edit-variant-dialog";

type VariantRow = {
  id: string;
  label: string;
  totalQuantity: number;
  lowStockThreshold?: number;
  availableNow: number;
  inUse: number;
  isActive: boolean;
  category: { id: string; name: string };
};

export function EquipmentVariantsTable({
  variants,
}: {
  variants: VariantRow[];
}) {
  const [editVariant, setEditVariant] = useState<VariantRow | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  function openEdit(v: VariantRow) {
    setEditVariant(v);
    setEditOpen(true);
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Size</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Active Rentals</TableHead>
              <TableHead>Available</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.map((v) => {
              const threshold = v.lowStockThreshold ?? 2;
              const isLowStock = v.availableNow < threshold && v.availableNow >= 0;
              return (
              <TableRow key={v.id} className={isLowStock ? "bg-amber-50 dark:bg-amber-950/20" : undefined}>
                <TableCell className="font-medium">{v.label}</TableCell>
                <TableCell>{v.totalQuantity}</TableCell>
                <TableCell>{v.inUse}</TableCell>
                <TableCell>
                  <span className={isLowStock ? "font-medium text-amber-700 dark:text-amber-400" : ""}>
                    {v.availableNow}
                    {isLowStock ? " (low)" : ""}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(v)}
                  >
                    Edit
                  </Button>
                </TableCell>
              </TableRow>
            );
            })}
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No variants yet. Add one to get started.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <EditVariantDialog
        key={editVariant?.id ?? "closed"}
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) setEditVariant(null);
        }}
        variant={editVariant}
      />
    </>
  );
}
