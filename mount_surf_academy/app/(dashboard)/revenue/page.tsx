import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";
import Link from "next/link";

type SearchParams = { range?: string };

export default async function RevenuePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const sp = await searchParams;
  const chartDays = sp.range === "30" ? 30 : 14;

  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const startOfChart = new Date(now);
  startOfChart.setDate(now.getDate() - chartDays + 1);
  startOfChart.setHours(0, 0, 0, 0);

  const [todayRevenue, weekRevenue, monthRevenue, byRental, byBooking, dailyPayments, todaysRentalsCount, todaysLessonsCount, rentalStats] =
    await Promise.all([
      prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfWeek, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfMonth, lte: endOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          rentalId: { not: null },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          bookingId: { not: null },
        },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: {
          businessId,
          status: PaymentStatus.PAID,
          paidAt: { gte: startOfChart, lte: endOfDay },
        },
        select: { amount: true, paidAt: true },
      }),
      prisma.rental.count({
        where: {
          businessId,
          startAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.booking.count({
        where: {
          businessId,
          lessonId: { not: null },
          startAt: { gte: startOfDay, lte: endOfDay },
        },
      }),
      prisma.rental.aggregate({
        where: { businessId },
        _count: true,
        _sum: { priceTotal: true },
      }),
    ]);

  const today = todayRevenue._sum.amount?.toString() ?? "0.00";
  const week = weekRevenue._sum.amount?.toString() ?? "0.00";
  const month = monthRevenue._sum.amount?.toString() ?? "0.00";
  const rentalRev = byRental._sum.amount?.toString() ?? "0.00";
  const lessonRev = byBooking._sum.amount?.toString() ?? "0.00";

  const totalRentals = rentalStats._count ?? 0;
  const totalRentalRevenue = Number(rentalStats._sum.priceTotal ?? 0);
  const avgRentalValue = totalRentals > 0 ? (totalRentalRevenue / totalRentals).toFixed(2) : "0.00";

  const dailyMap = new Map<string, number>();
  for (let d = 0; d < chartDays; d++) {
    const date = new Date(startOfChart);
    date.setDate(startOfChart.getDate() + d);
    const key = date.toISOString().slice(0, 10);
    dailyMap.set(key, 0);
  }
  for (const p of dailyPayments) {
    const key = p.paidAt.toISOString().slice(0, 10);
    const amt = Number(p.amount);
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + amt);
  }
  const chartData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, amount]) => ({ date, amount }));
  const maxAmount = Math.max(1, ...chartData.map((d) => d.amount));

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-xl font-semibold tracking-tight">Revenue</div>
        <div className="text-sm text-muted-foreground">
          Revenue from paid payments. Never delete payments — audit trail stays intact.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${today}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              This week
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${week}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              This month
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${month}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Rentals today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {todaysRentalsCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Lessons today
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {todaysLessonsCount}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Avg rental value
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            ${avgRentalValue}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Revenue by type</CardTitle>
          <p className="text-sm text-muted-foreground">
            All-time paid amounts
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Rental revenue</div>
            <div className="text-2xl font-semibold">${rentalRev}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-sm text-muted-foreground">Lesson revenue</div>
            <div className="text-2xl font-semibold">${lessonRev}</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Revenue by date</CardTitle>
              <p className="text-sm text-muted-foreground">
                Last {chartDays} days
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/revenue?range=14"
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  chartDays === 14 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                14 days
              </Link>
              <Link
                href="/revenue?range=30"
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  chartDays === 30 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                30 days
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {chartData.map(({ date, amount }) => (
              <div
                key={date}
                className="flex flex-1 flex-col items-center gap-1"
                title={`${date}: $${amount.toFixed(2)}`}
              >
                <div
                  className="w-full min-w-2 rounded-t bg-primary/80 transition-opacity hover:opacity-90"
                  style={{
                    height: `${(amount / maxAmount) * 100}%`,
                    minHeight: amount > 0 ? "4px" : "0",
                  }}
                />
                <span className="text-[10px] text-muted-foreground">
                  {new Date(date).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
