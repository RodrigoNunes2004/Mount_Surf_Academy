import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";

export default async function DashboardPage() {
  const session = await requireSession();
  const businessId = session.user?.businessId;

  const [customers, rentals, bookings, payments] = await Promise.all([
    prisma.customer.count({ where: { businessId } }),
    prisma.rental.count({ where: { businessId } }),
    prisma.booking.count({ where: { businessId } }),
    prisma.payment.count({ where: { businessId } }),
  ]);

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
          <CardTitle className="text-sm text-muted-foreground">Rentals</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{rentals}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Bookings</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{bookings}</CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">Payments</CardTitle>
        </CardHeader>
        <CardContent className="text-3xl font-semibold">{payments}</CardContent>
      </Card>
    </div>
  );
}

