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

type CustomerOption = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
};
type CategoryOption = { id: string; name: string };
type VariantOption = {
  id: string;
  label: string;
  categoryId: string;
  category: { name: string };
};

function toDateTimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(d: Date, minutes: number) {
  return new Date(d.getTime() + minutes * 60_000);
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "EFTPOS", label: "EFTPOS" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "ONLINE", label: "Online" },
] as const;

export function CreateRentalDialog({
  customers,
  categories,
  variants,
}: {
  customers: CustomerOption[];
  categories: CategoryOption[];
  variants: VariantOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const [customerId, setCustomerId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [priceTotal, setPriceTotal] = useState("");
  const [method, setMethod] = useState<"CASH" | "EFTPOS" | "CARD" | "TRANSFER" | "ONLINE">("CASH");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(now));
  const [endAt, setEndAt] = useState(toDateTimeLocalValue(addMinutes(now, 60)));

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );
  const variantsForCategory = useMemo(
    () => variants.filter((v) => v.categoryId === categoryId),
    [variants, categoryId],
  );
  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) ?? null,
    [variants, variantId],
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
        equipmentVariantId: variantId,
        quantity: Math.max(1, Math.trunc(Number(quantity)) || 1),
        priceTotal: Number(priceTotal) || 0,
        method,
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
    setCategoryId("");
    setVariantId("");
    setQuantity("1");
    setPriceTotal("");
    setMethod("CASH");
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
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New rental</DialogTitle>
          <DialogDescription>
            Create a rental with immediate payment. Equipment availability is
            checked for the selected time window.
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
                        }`;
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
          </div>

          <div className="grid gap-2">
            <Label>Equipment category</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setVariantId("");
              }}
            >
              <option value="">Select category…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="variant">Size / variant</Label>
            <Popover open={variantOpen} onOpenChange={setVariantOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={variantOpen}
                  className="h-10 w-full justify-between"
                  id="variant"
                  disabled={!categoryId}
                >
                  {selectedVariant ? (
                    <span>
                      {selectedVariant.category.name} {selectedVariant.label}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {categoryId
                        ? "Select size…"
                        : "Select category first"}
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search size..." />
                  <CommandList>
                    <CommandEmpty>No variant found.</CommandEmpty>
                    <CommandGroup>
                      {variantsForCategory.map((v) => {
                        const label = `${v.category.name} ${v.label}`;
                        return (
                          <CommandItem
                            key={v.id}
                            value={label}
                            onSelect={() => {
                              setVariantId(v.id);
                              setVariantOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                variantId === v.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <span>{label}</span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="priceTotal">Price (NZD)</Label>
              <Input
                id="priceTotal"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={priceTotal}
                onChange={(e) => setPriceTotal(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Payment method</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={method}
              onChange={(e) =>
                setMethod(e.target.value as "CASH" | "EFTPOS" | "CARD" | "TRANSFER" | "ONLINE")
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
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
              <Label htmlFor="endAt">Expected end</Label>
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
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !customerId ||
                !variantId ||
                !priceTotal ||
                Number(priceTotal) <= 0
              }
            >
              {loading ? "Creating…" : "Create rental"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
