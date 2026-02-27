import { requireSession } from "@/lib/server/session";
import { DashboardSidebar } from "@/components/dashboard/sidebar";
import { DashboardShell } from "./shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return (
    <DashboardShell sidebar={<DashboardSidebar />}>{children}</DashboardShell>
  );
}

