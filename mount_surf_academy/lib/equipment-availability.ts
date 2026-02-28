import { BookingStatus, RentalStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIVE_RENTAL_STATUSES = [RentalStatus.ACTIVE, RentalStatus.OVERDUE] as const;
const ACTIVE_BOOKING_STATUSES = [BookingStatus.BOOKED, BookingStatus.CHECKED_IN] as const;

/** Compute in-use quantity per variant: rentals + booking allocations overlapping the time window */
export async function getInUseByVariant(
  businessId: string,
  variantIds: string[],
  windowStart: Date,
  windowEnd: Date,
): Promise<Map<string, number>> {
  const inUseMap = new Map<string, number>();

  if (variantIds.length === 0) return inUseMap;

  const [rentals, allocations] = await Promise.all([
    prisma.rental.findMany({
      where: {
        businessId,
        equipmentVariantId: { in: variantIds },
        status: { in: [...ACTIVE_RENTAL_STATUSES] },
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      select: { equipmentVariantId: true, quantity: true },
    }),
    prisma.bookingEquipmentAllocation.findMany({
      where: {
        equipmentVariantId: { in: variantIds },
        booking: {
          businessId,
          status: { in: [...ACTIVE_BOOKING_STATUSES] },
          startAt: { lt: windowEnd },
          endAt: { gt: windowStart },
        },
      },
      select: { equipmentVariantId: true, quantity: true },
    }),
  ]);

  for (const r of rentals) {
    if (r.equipmentVariantId) {
      inUseMap.set(
        r.equipmentVariantId,
        (inUseMap.get(r.equipmentVariantId) ?? 0) + r.quantity,
      );
    }
  }
  for (const a of allocations) {
    inUseMap.set(
      a.equipmentVariantId,
      (inUseMap.get(a.equipmentVariantId) ?? 0) + a.quantity,
    );
  }

  return inUseMap;
}
