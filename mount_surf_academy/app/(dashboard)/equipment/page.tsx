import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";
import { CreateCategoryDialog } from "@/components/equipment/create-category-dialog";
import { CreateVariantDialog } from "@/components/equipment/create-variant-dialog";
import { EquipmentVariantsTable } from "@/components/equipment/variants-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getInUseByVariant } from "@/lib/equipment-availability";
import Link from "next/link";

type SearchParams = { category?: string };

type VariantWithAvailability = {
  id: string;
  label: string;
  totalQuantity: number;
  lowStockThreshold: number;
  isActive: boolean;
  category: { id: string; name: string };
  availableNow: number;
  inUse: number;
};

type PrismaWithCategory = typeof prisma & {
  equipmentCategory: {
    findMany: (args: unknown) => Promise<unknown[]>;
    findFirst: (args: unknown) => Promise<unknown | null>;
  };
  equipmentVariant: { findMany: (args: unknown) => Promise<unknown[]> };
};

async function getVariantsWithAvailability(
  businessId: string,
  categoryId: string,
) {
  const prismaCat = prisma as unknown as PrismaWithCategory;
  const variants = await prismaCat.equipmentVariant.findMany({
    where: { businessId, categoryId },
    orderBy: { label: "asc" },
    include: {
      category: { select: { id: true, name: true } },
    },
  }) as { id: string; label: string; totalQuantity: number; lowStockThreshold: number; isActive: boolean; category: { id: string; name: string } }[];

  const variantIds = variants.map((v) => v.id);
  const now = new Date();
  const inUseMap = await getInUseByVariant(businessId, variantIds, now, now);

  return variants.map((v) => {
    const inUse = inUseMap.get(v.id) ?? 0;
    const availableNow = Math.max(0, v.totalQuantity - inUse);
    return {
      ...v,
      availableNow,
      inUse,
      lowStockThreshold: v.lowStockThreshold ?? 2,
    };
  });
}

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const sp = await searchParams;
  const selectedCategoryId = sp.category?.trim() || null;

  const prismaCat = prisma as unknown as PrismaWithCategory;
  const [categories, selectedCategory, variants] = await Promise.all([
    prismaCat.equipmentCategory.findMany({
      where: { businessId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { variants: true } },
      },
    }),
    selectedCategoryId
      ? prismaCat.equipmentCategory.findFirst({
          where: { id: selectedCategoryId, businessId },
          include: { variants: { where: { isActive: true }, orderBy: { label: "asc" } } },
        })
      : Promise.resolve(null),
    selectedCategoryId
      ? getVariantsWithAvailability(businessId, selectedCategoryId)
      : Promise.resolve([]) as Promise<VariantWithAvailability[]>,
  ]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Equipment</div>
          <div className="text-sm text-muted-foreground">
            Manage inventory by type and variant. Adjust quantities when you buy
            or retire equipment.
          </div>
        </div>
        <CreateCategoryDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categories</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click a category to view and edit variants (sizes).
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/equipment">
              <div
                className={`rounded-lg border px-4 py-3 transition-colors ${
                  !selectedCategoryId
                    ? "border-primary bg-primary/10"
                    : "hover:bg-muted/50"
                }`}
              >
                <span className="font-medium">All</span>
              </div>
            </Link>
            {(categories as { id: string; name: string; trackSizes: boolean; _count: { variants: number } }[]).map((cat) => {
              const isSelected = selectedCategoryId === cat.id;
              return (
                <Link key={cat.id} href={`/equipment?category=${cat.id}`}>
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-4 py-3 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <span className="font-medium">{cat.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {cat._count.variants} sizes
                    </Badge>
                    {!cat.trackSizes ? (
                      <Badge variant="outline" className="text-xs">
                        No sizes
                      </Badge>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedCategory ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">
                {(selectedCategory as { id: string; name: string }).name} — variants
              </CardTitle>
              <CreateVariantDialog
                categoryId={(selectedCategory as { id: string; name: string }).id}
                categoryName={(selectedCategory as { id: string; name: string }).name}
              />
            </div>
          </CardHeader>
          <CardContent>
            <EquipmentVariantsTable variants={variants as VariantWithAvailability[]} />
          </CardContent>
        </Card>
      ) : selectedCategoryId ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Category not found.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Select a category above to view variants.
          </CardContent>
        </Card>
      )}

    </div>
  );
}
