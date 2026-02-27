"use client";

import type { ReactNode } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DashboardTopbar } from "@/components/dashboard/topbar";
import { useState } from "react";

export function DashboardShell({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="hidden md:fixed md:inset-y-0 md:flex">{sidebar}</div>

      <div className="md:pl-64">
        <DashboardTopbar onOpenNav={() => setOpen(true)} />
        <main className="p-4">{children}</main>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0">
          {sidebar}
        </SheetContent>
      </Sheet>
    </div>
  );
}

