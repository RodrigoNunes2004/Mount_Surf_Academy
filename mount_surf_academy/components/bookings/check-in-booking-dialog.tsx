"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";

type CategoryOption = {
  id: string;
  name: string;
  totalQuantity: number;
};

export function CheckInBookingDialog({
  bookingId,
  defaultQuantity,
  categories,
}: {
  bookingId: string;
  defaultQuantity: number;
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [equipmentCategoryId, setEquipmentCategoryId] = useState("");
  const [quantity, setQuantity] = useState(defaultQuantity);

  const selected = useMemo(
    () => categories.find((c) => c.id === equipmentCategoryId) ?? null,
    [categories, equipmentCategoryId],
  );

  async function checkIn() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "CHECKED_IN",
        equipmentCategoryId,
        quantity,
      }),
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
            Convert booking into an active rental and deduct inventory.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Equipment category</Label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoryOpen}
                  className="h-10 w-full justify-between"
                  id="category"
                >
                  {selected ? (
                    <span className="truncate">
                      {selected.name} • total {selected.totalQuantity}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Type to search category…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search category..." />
                  <CommandList>
                    <CommandEmpty>No category found.</CommandEmpty>
                    <CommandGroup>
                      {categories.map((c) => {
                        const label = `${c.name} • total ${c.totalQuantity}`;
                        return (
                          <CommandItem
                            key={c.id}
                            value={label}
                            onSelect={() => {
                              setEquipmentCategoryId(c.id);
                              setCategoryOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                equipmentCategoryId === c.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span className="truncate">{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={100}
              value={quantity}
              onChange={(e) => setQuantity(Math.trunc(Number(e.target.value)))}
            />
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={checkIn} disabled={loading || !equipmentCategoryId}>
              {loading ? "Checking in..." : "Check in"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

