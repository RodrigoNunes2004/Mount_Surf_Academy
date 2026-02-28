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

type LessonOption = {
  id: string;
  title: string;
  durationMinutes: number;
  capacity: number | null;
  price?: unknown;
};

type InstructorOption = {
  id: string;
  firstName: string;
  lastName: string;
};

type VariantOption = {
  id: string;
  label: string;
  categoryId: string;
  category: { id: string; name: string };
};

type CategoryOption = { id: string; name: string };

function toDateTimeLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateLessonBookingDialog({
  customers,
  lessons,
  instructors,
  categories,
  variants,
}: {
  customers: CustomerOption[];
  lessons: LessonOption[];
  instructors: InstructorOption[];
  categories: CategoryOption[];
  variants: VariantOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const [customerId, setCustomerId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [instructorId, setInstructorId] = useState("");
  const [participants, setParticipants] = useState(1);
  const [startAt, setStartAt] = useState(toDateTimeLocalValue(now));
  const [boardVariantId, setBoardVariantId] = useState("");
  const [wetsuitVariantId, setWetsuitVariantId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "EFTPOS" | "CARD" | "ONLINE">("CASH");

  const [customerOpen, setCustomerOpen] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [instructorOpen, setInstructorOpen] = useState(false);

  const boardVariants = variants.filter(
    (v) => v.category.name === "Softboard" || v.category.name === "Hardboard",
  );
  const wetsuitVariants = variants.filter((v) => v.category.name === "Wetsuit");

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === customerId) ?? null,
    [customers, customerId],
  );
  const selectedLesson = useMemo(
    () => lessons.find((l) => l.id === lessonId) ?? null,
    [lessons, lessonId],
  );
  const selectedInstructor = useMemo(
    () => instructors.find((i) => i.id === instructorId) ?? null,
    [instructors, instructorId],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!boardVariantId || !wetsuitVariantId) {
      setError("Select board and wetsuit sizes.");
      return;
    }
    if (!instructorId) {
      setError("Select an instructor.");
      return;
    }

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId,
        lessonId,
        participants,
        startAt: new Date(startAt).toISOString(),
        durationMinutes: selectedLesson?.durationMinutes ?? 60,
        instructorId,
        equipmentAllocations: [
          { equipmentVariantId: boardVariantId, quantity: participants },
          { equipmentVariantId: wetsuitVariantId, quantity: participants },
        ],
        paymentMethod,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(payload?.error ?? "Failed to create booking.");
      return;
    }

    setOpen(false);
    setCustomerId("");
    setLessonId("");
    setInstructorId("");
    setParticipants(1);
    setBoardVariantId("");
    setWetsuitVariantId("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New lesson booking</DialogTitle>
          <DialogDescription>
            Select board and wetsuit sizes. Equipment is reserved for the lesson time.
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="instructor">Instructor *</Label>
            <Popover open={instructorOpen} onOpenChange={setInstructorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={instructorOpen}
                  className="h-10 w-full justify-between"
                  id="instructor"
                >
                  {selectedInstructor ? (
                    <span className="truncate">
                      {selectedInstructor.firstName} {selectedInstructor.lastName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Select instructor…</span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search instructor..." />
                  <CommandList>
                    <CommandEmpty>No instructor found. Add instructors in Settings.</CommandEmpty>
                    <CommandGroup>
                      {instructors.map((i) => {
                        const label = `${i.firstName} ${i.lastName}`;
                        return (
                          <CommandItem
                            key={i.id}
                            value={label}
                            onSelect={() => {
                              setInstructorId(i.id);
                              setInstructorOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                instructorId === i.id ? "opacity-100" : "opacity-0",
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
            <Label htmlFor="lesson">Lesson</Label>
            <Popover open={lessonOpen} onOpenChange={setLessonOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={lessonOpen}
                  className="h-10 w-full justify-between"
                  id="lesson"
                >
                  {selectedLesson ? (
                    <span className="truncate">
                      {selectedLesson.title} • {selectedLesson.durationMinutes} min
                      {selectedLesson.capacity ? ` • cap ${selectedLesson.capacity}` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      Type to search lesson…
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Search lesson..." />
                  <CommandList>
                    <CommandEmpty>No lesson found.</CommandEmpty>
                    <CommandGroup>
                      {lessons.map((l) => {
                        const label = `${l.title} • ${l.durationMinutes} min${
                          l.capacity ? ` • cap ${l.capacity}` : ""
                        }`;
                        return (
                          <CommandItem
                            key={l.id}
                            value={label}
                            onSelect={() => {
                              setLessonId(l.id);
                              setLessonOpen(false);
                            }}
                            className="gap-2"
                          >
                            <Check
                              className={cn(
                                "size-4",
                                lessonId === l.id ? "opacity-100" : "opacity-0",
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

          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="boardVariant">Board size</Label>
              <select
                id="boardVariant"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={boardVariantId}
                onChange={(e) => setBoardVariantId(e.target.value)}
              >
                <option value="">Select board…</option>
                {boardVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.category.name} {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wetsuitVariant">Wetsuit size</Label>
              <select
                id="wetsuitVariant"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={wetsuitVariantId}
                onChange={(e) => setWetsuitVariantId(e.target.value)}
              >
                <option value="">Select wetsuit…</option>
                {wetsuitVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
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
              <Label htmlFor="participants">Participants</Label>
              <Input
                id="participants"
                type="number"
                min={1}
                max={100}
                value={participants}
                onChange={(e) => setParticipants(Math.trunc(Number(e.target.value)))}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paymentMethod">Payment method</Label>
            <select
              id="paymentMethod"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as "CASH" | "EFTPOS" | "CARD" | "ONLINE")
              }
            >
              <option value="CASH">Cash</option>
              <option value="EFTPOS">EFTPOS</option>
              <option value="CARD">Card</option>
              <option value="ONLINE">Online</option>
            </select>
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
                !lessonId ||
                !instructorId ||
                !boardVariantId ||
                !wetsuitVariantId
              }
            >
              {loading ? "Creating..." : "Create booking"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

