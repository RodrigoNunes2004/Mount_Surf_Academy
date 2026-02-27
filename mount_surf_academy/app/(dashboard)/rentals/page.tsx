import { RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";
import { CreateRentalDialog } from "@/components/rentals/create-rental-dialog";
import { CancelRentalButton, ReturnRentalButton } from "@/components/rentals/rental-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = {
  status?: string;
};

function statusBadge(status: RentalStatus) {
  if (status === RentalStatus.RETURNED) return <Badge variant="secondary">Returned</Badge>;
  if (status === RentalStatus.CANCELLED) return <Badge variant="secondary">Cancelled</Badge>;
  if (status === RentalStatus.OVERDUE) return <Badge variant="destructive">Overdue</Badge>;
  return <Badge>Active</Badge>;
}

export default async function RentalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const sp = await searchParams;
  const statusRaw = (sp.status ?? "active").toLowerCase();
  const statusFilter =
    statusRaw === "returned"
      ? [RentalStatus.RETURNED]
      : statusRaw === "cancelled"
        ? [RentalStatus.CANCELLED]
        : statusRaw === "history"
          ? [RentalStatus.RETURNED, RentalStatus.CANCELLED]
          : [RentalStatus.ACTIVE, RentalStatus.OVERDUE];

  const [customers, equipment, rentals] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, archivedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
      },
    }),
    prisma.equipment.findMany({
      where: { businessId, status: "AVAILABLE" },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, category: true, size: true, description: true },
    }),
    prisma.rental.findMany({
      where: {
        businessId,
        status: { in: statusFilter },
      },
      orderBy: { startAt: "desc" },
      take: 50,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        equipment: { select: { category: true, size: true } },
      },
    }),
  ]);

  const now = new Date();

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Rentals</div>
          <div className="text-sm text-muted-foreground">
            Create rentals, return equipment, and keep an audit trail.
          </div>
        </div>
        <CreateRentalDialog customers={customers} equipment={equipment} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Recent rentals</CardTitle>
            <div className="text-sm text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-foreground">
                {statusRaw === "history"
                  ? "History"
                  : statusRaw === "returned"
                    ? "Returned"
                    : statusRaw === "cancelled"
                      ? "Cancelled"
                      : "Active"}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentals.map((r) => {
                  const canCancel =
                    r.status === RentalStatus.ACTIVE && r.startAt > now;
                  const canReturn =
                    r.status === RentalStatus.ACTIVE || r.status === RentalStatus.OVERDUE;

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.customer.firstName} {r.customer.lastName}
                      </TableCell>
                      <TableCell>
                        {r.equipment.category}
                        {r.equipment.size ? ` • ${r.equipment.size}` : ""}
                      </TableCell>
                      <TableCell>{new Date(r.startAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(r.endAt).toLocaleString()}</TableCell>
                      <TableCell>{statusBadge(r.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canReturn ? <ReturnRentalButton rentalId={r.id} /> : null}
                          <CancelRentalButton rentalId={r.id} disabled={!canCancel} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

                {rentals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center">
                      No rentals found.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

