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

type CustomerOption = { id: string; firstName: string; lastName: string; phone: string | null; email: string | null };
type EquipmentOption = { id: string; category: string; size: string | null; description: string | null };

function toDateTimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

export function CreateRentalDialog({
  customers,
  equipment,
}: {
  customers: CustomerOption[];
  equipment: EquipmentOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const [customerId, setCustomerId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(now));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(addMinutes(now, 60)));

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );
  const selectedEquipment = useMemo(
    () => equipment.find((e) => e.id === equipmentId) ?? null,
    [equipment, equipmentId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/rentals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId,
        equipmentId,
        startAt: new Date(startAt).toISOString(),
        endAt: new Date(endAt).toISOString(),
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to create rental.");
      return;
    }

    setOpen(false);
    setCustomerId("");
    setEquipmentId("");
    router.refresh();
  }

  function setDuration(minutes: number) {
    const start = new Date(startAt);
    if (Number.isNaN(start.getTime())) return;
    setEndAt(toDateTimeLocalValue(addMinutes(start, minutes)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add rental</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New rental</DialogTitle>
          <DialogDescription>
            Create a rental. Equipment must be available.
          </DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label htmlFor="customer">Customer</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={customerOpen}
                  className="h-10 w-full justify-between"
                  id="customer"
                >
                  {selectedCustomer ? (
                    <span className="truncate">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                      {selectedCustomer.phone ? ` • ${selectedCustomer.phone}` : ""}
                      {selectedCustomer.email ? ` • ${selectedCustomer.email}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Type to search customer…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search customer..." />
                  <CommandList>
                    <CommandEmpty>No customer found.</CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => {
                        const label = `${c.firstName} ${c.lastName}${
                          c.phone ? ` • ${c.phone}` : ""
                        }${c.email ? ` • ${c.email}` : ""}`;
                        return (
                          <CommandItem
                            key={c.id}
                            value={label}
                            onSelect={() => {
                              setCustomerId(c.id);
                              setCustomerOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                customerId === c.id ? "opacity-100" : "opacity-0",
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
            <input type="hidden" name="customerId" value={customerId} required />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="equipment">Equipment</Label>
            <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={equipmentOpen}
                  className="h-10 w-full justify-between"
                  id="equipment"
                >
                  {selectedEquipment ? (
                    <span className="truncate">
                      {selectedEquipment.category}
                      {selectedEquipment.size ? ` • ${selectedEquipment.size}` : ""}
                      {selectedEquipment.description
                        ? ` • ${selectedEquipment.description}`
                        : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Type to search equipment…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search equipment..." />
                  <CommandList>
                    <CommandEmpty>No equipment found.</CommandEmpty>
                    <CommandGroup>
                      {equipment.map((eq) => {
                        const label = `${eq.category}${eq.size ? ` • ${eq.size}` : ""}${
                          eq.description ? ` • ${eq.description}` : ""
                        }`;
                        return (
                          <CommandItem
                            key={eq.id}
                            value={label}
                            onSelect={() => {
                              setEquipmentId(eq.id);
                              setEquipmentOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                equipmentId === eq.id ? "opacity-100" : "opacity-0",
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
            <input type="hidden" name="equipmentId" value={equipmentId} required />
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="startAt">Start</Label>
              <Input
                id="startAt"
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endAt">End</Label>
              <Input
                id="endAt"
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => setDuration(60)}>
              +1h
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDuration(120)}>
              +2h
            </Button>
            <Button type="button" variant="secondary" onClick={() => setDuration(180)}>
              +3h
            </Button>
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create rental"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

