"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Instructor = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  hourlyRate: number | string | null;
  isActive: boolean;
};

export function InstructorsSection() {
  const router = useRouter();
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetch("/api/instructors")
      .then((r) => r.json())
      .then((json: { data?: Instructor[] }) => setInstructors(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function createInstructor(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFormLoading(true);
    try {
      const res = await fetch("/api/instructors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim() || null,
          email: email.trim() || null,
          hourlyRate: hourlyRate.trim() ? Number(hourlyRate) : undefined,
          isActive,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Failed to add instructor.");
        return;
      }
      setDialogOpen(false);
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setHourlyRate("");
      setIsActive(true);
      router.refresh();
      const listRes = await fetch("/api/instructors");
      const list = (await listRes.json()) as { data?: Instructor[] };
      if (list.data) setInstructors(list.data);
    } finally {
      setFormLoading(false);
    }
  }

  const [editing, setEditing] = useState<Instructor | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  function openEdit(i: Instructor) {
    setEditing(i);
    setEditFirstName(i.firstName);
    setEditLastName(i.lastName);
    setEditPhone(i.phone ?? "");
    setEditEmail(i.email ?? "");
    setEditHourlyRate(
      i.hourlyRate != null && i.hourlyRate !== ""
        ? String(typeof i.hourlyRate === "number" ? i.hourlyRate : i.hourlyRate)
        : ""
    );
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/instructors/${editing.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          phone: editPhone.trim() || null,
          email: editEmail.trim() || null,
          hourlyRate: editHourlyRate.trim() ? Number(editHourlyRate) : null,
        }),
      });
      if (res.ok) {
        setEditing(null);
        router.refresh();
        const listRes = await fetch("/api/instructors");
        const list = (await listRes.json()) as { data?: Instructor[] };
        if (list.data) setInstructors(list.data);
      } else {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Failed to update.");
      }
    } finally {
      setEditLoading(false);
    }
  }

  async function toggleActive(id: string, current: boolean) {
    const res = await fetch(`/api/instructors/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !current }),
    });
    if (res.ok) {
      router.refresh();
      setInstructors((prev) =>
        prev.map((i) => (i.id === id ? { ...i, isActive: !current } : i))
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Add instructors to assign to lesson bookings. Active instructors appear in the booking
          form.
        </p>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add instructor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New instructor</DialogTitle>
              <DialogDescription>
                Add an instructor. Hourly rate is optional (for future payroll).
              </DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={createInstructor}>
              {error && (
                <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="firstName">First name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastName">Last name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="hourlyRate">Hourly rate (optional)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  min={0}
                  step={0.01}
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded border"
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? "Adding…" : "Add instructor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading instructors…</p>
      ) : instructors.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No instructors yet. Add one to get started. Instructors are required for lesson bookings.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Hourly rate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructors.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">
                  {i.firstName} {i.lastName}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {[i.phone, i.email].filter(Boolean).join(" · ") || "—"}
                </TableCell>
                <TableCell>
                  {i.hourlyRate != null && i.hourlyRate !== ""
                    ? String(i.hourlyRate)
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={i.isActive ? "default" : "secondary"}>
                    {i.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(i)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleActive(i.id, i.isActive)}
                    >
                      {i.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit instructor</DialogTitle>
            <DialogDescription>Update instructor details.</DialogDescription>
          </DialogHeader>
          {editing && (
            <form className="grid gap-4" onSubmit={saveEdit}>
              {error && (
                <div className="rounded-md bg-destructive/10 text-destructive px-3 py-2 text-sm">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="edit-firstName">First name *</Label>
                <Input
                  id="edit-firstName"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-lastName">Last name *</Label>
                <Input
                  id="edit-lastName"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-hourlyRate">Hourly rate (optional)</Label>
                <Input
                  id="edit-hourlyRate"
                  type="number"
                  min={0}
                  step={0.01}
                  value={editHourlyRate}
                  onChange={(e) => setEditHourlyRate(e.target.value)}
                  placeholder="e.g. 35"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={editLoading}>
                  {editLoading ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
