import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";
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
import { CreateLessonBookingDialog } from "@/components/bookings/create-lesson-booking-dialog";
import { CancelBookingButton, CompleteBookingButton, NoShowBookingButton } from "@/components/bookings/booking-actions";
import { CheckInBookingDialog } from "@/components/bookings/check-in-booking-dialog";

type SearchParams = {
  status?: string;
};

function statusBadge(status: BookingStatus) {
  if (status === BookingStatus.CANCELLED)
    return <Badge variant="secondary">Cancelled</Badge>;
  if (status === BookingStatus.NO_SHOW)
    return <Badge variant="secondary">No-show</Badge>;
  if (status === BookingStatus.CHECKED_IN)
    return <Badge variant="secondary">Checked in</Badge>;
  if (status === BookingStatus.COMPLETED)
    return <Badge variant="secondary">Completed</Badge>;
  return <Badge>Booked</Badge>;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const sp = await searchParams;
  const statusRaw = (sp.status ?? "booked").toLowerCase();
  const statusFilter =
    statusRaw === "completed"
      ? [BookingStatus.COMPLETED]
      : statusRaw === "cancelled"
        ? [BookingStatus.CANCELLED]
        : statusRaw === "history"
          ? [BookingStatus.COMPLETED, BookingStatus.CANCELLED, BookingStatus.NO_SHOW]
          : [BookingStatus.BOOKED, BookingStatus.CHECKED_IN];

  const [customers, lessons, categories, bookings] = await Promise.all([
    prisma.customer.findMany({
      where: { businessId, archivedAt: null } as never,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 200,
      select: { id: true, firstName: true, lastName: true, phone: true, email: true },
    }),
    prisma.lesson.findMany({
      where: { businessId },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, durationMinutes: true, capacity: true },
    }),
    prisma.equipmentCategory.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      take: 200,
      select: { id: true, name: true, totalQuantity: true },
    }),
    prisma.booking.findMany({
      where: { businessId, status: { in: statusFilter } },
      orderBy: { startAt: "desc" },
      take: 50,
      include: {
        customer: { select: { firstName: true, lastName: true } },
        lesson: { select: { title: true, durationMinutes: true } },
        rental: { select: { id: true } },
      },
    }),
  ]);

  const now = new Date();

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Bookings</div>
          <div className="text-sm text-muted-foreground">
            Lesson bookings share the same engine as rentals (time windows + status).
          </div>
        </div>
        <CreateLessonBookingDialog customers={customers} lessons={lessons} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base">Recent bookings</CardTitle>
            <div className="text-sm text-muted-foreground">
              Status:{" "}
              <span className="font-medium text-foreground">
                {statusRaw === "history"
                  ? "History"
                  : statusRaw === "completed"
                    ? "Completed"
                    : statusRaw === "cancelled"
                      ? "Cancelled"
                      : "Booked"}
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
                  <TableHead>Lesson</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Participants</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings.map((b) => {
                  const canCancel = b.status === BookingStatus.BOOKED && b.startAt > now;
                  const canCheckIn = b.status === BookingStatus.BOOKED && !b.rental;
                  const canComplete = b.status === BookingStatus.CHECKED_IN;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.customer.firstName} {b.customer.lastName}
                      </TableCell>
                      <TableCell>
                        {b.lesson?.title ?? "—"}
                        {b.lesson?.durationMinutes
                          ? ` • ${b.lesson.durationMinutes} min`
                          : ""}
                      </TableCell>
                      <TableCell>{new Date(b.startAt).toLocaleString()}</TableCell>
                      <TableCell>{new Date(b.endAt).toLocaleString()}</TableCell>
                      <TableCell>{b.participants}</TableCell>
                      <TableCell>{statusBadge(b.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canCheckIn ? (
                            <CheckInBookingDialog
                              bookingId={b.id}
                              defaultQuantity={b.participants}
                              categories={categories}
                            />
                          ) : null}
                          {canComplete ? (
                            <CompleteBookingButton bookingId={b.id} />
                          ) : null}
                          {canCancel ? (
                            <>
                              <CancelBookingButton bookingId={b.id} />
                              <NoShowBookingButton bookingId={b.id} />
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {bookings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center">
                      No bookings found.
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

