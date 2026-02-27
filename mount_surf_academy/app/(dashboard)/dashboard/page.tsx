import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookingStatus, RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const businessId = session.user.businessId;

  // Defensive: if generated enums are stale, filter out undefined.
  const activeBookingStatuses = [BookingStatus.BOOKED, BookingStatus.CHECKED_IN].filter(
    Boolean,
  ) as BookingStatus[];

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [customers, activeRentals, todaysBookings, todaysRevenueAgg, equipmentOut, categoryOutAgg] =
    await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.rental.count({
      where: { businessId, status: { in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] } },
    }),
    prisma.booking.count({
      where: {
        businessId,
        status: { in: activeBookingStatuses },
        startAt: { gte: startOfDay, lte: endOfDay },
      },
    }),
    prisma.payment.aggregate({
      where: { businessId, createdAt: { gte: startOfDay, lte: endOfDay } },
      _sum: { amount: true },
    }),
    prisma.equipment.count({ where: { businessId, status: "RENTED" } }),
    prisma.rental.aggregate({
      where: {
        businessId,
        equipmentCategoryId: { not: null },
        status: { in: [RentalStatus.ACTIVE, RentalStatus.OVERDUE] },
      },
      _sum: { quantity: true },
    }),
  ]);

  const todaysRevenue = todaysRevenueAgg._sum.amount?.toString() ?? "0.00";
  const categoryOut = categoryOutAgg._sum.quantity ?? 0;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Customers
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{customers}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Active rentals
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {activeRentals}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Today&apos;s bookings
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {todaysBookings}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Today&apos;s revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {todaysRevenue}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">
            Equipment out
          </CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">
          {equipmentOut + categoryOut}
        </CardContent>
      </Card>
    </div>
  );
}

