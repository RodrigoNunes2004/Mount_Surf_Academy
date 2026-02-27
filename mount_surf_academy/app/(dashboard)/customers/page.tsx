import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/server/session";
import { CreateCustomerDialog } from "@/components/customers/create-customer-dialog";
import { EditCustomerDialog } from "@/components/customers/edit-customer-dialog";
import {
  ArchiveCustomerButton,
  UnarchiveCustomerButton,
} from "@/components/customers/archive-customer-button";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = {
  q?: string;
  status?: "active" | "archived" | string;
  sort?: "newest" | "oldest" | "name_asc" | "name_desc" | string;
  page?: string;
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), min), max);
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const businessId = session.user.businessId;

  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const statusRaw = (sp.status ?? "active").toLowerCase();
  const status = statusRaw === "archived" ? "archived" : "active";
  const sort = (sp.sort ?? "newest").toLowerCase();

  const page = clampInt(sp.page, 1, 1, 10_000);
  const take = 20;
  const skip = (page - 1) * take;

  const archivedWhere =
    status === "archived" ? { archivedAt: { not: null } } : { archivedAt: null };

  const where = {
    businessId,
    ...archivedWhere,
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { phone: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const orderBy =
    sort === "name_asc"
      ? [{ lastName: "asc" as const }, { firstName: "asc" as const }]
      : sort === "name_desc"
        ? [{ lastName: "desc" as const }, { firstName: "desc" as const }]
        : sort === "oldest"
          ? [{ createdAt: "asc" as const }]
          : [{ createdAt: "desc" as const }];

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy,
      take,
      skip,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        createdAt: true,
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / take));

  function pageHref(nextPage: number) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status !== "active") p.set("status", status);
    if (sort && sort !== "newest") p.set("sort", sort);
    p.set("page", String(nextPage));
    return `/customers?${p.toString()}`;
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
        <div>
          <div className="text-xl font-semibold tracking-tight">Customers</div>
          <div className="text-sm text-muted-foreground">
            Create and manage surf school customers.
          </div>
        </div>
        <CreateCustomerDialog />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle className="text-base">Customer list</CardTitle>

            <form
              action="/customers"
              method="GET"
              className="flex flex-col gap-2 md:flex-row md:items-end"
            >
              <input type="hidden" name="page" value="1" />
              <div className="grid gap-1">
                <Label htmlFor="q" className="text-xs text-muted-foreground">
                  Search
                </Label>
                <Input
                  id="q"
                  name="q"
                  placeholder="Name, phone, email..."
                  defaultValue={q}
                  className="w-full md:w-64"
                />
              </div>
              <div className="grid gap-1">
                <Label htmlFor="status" className="text-xs text-muted-foreground">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={status}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="grid gap-1">
                <Label htmlFor="sort" className="text-xs text-muted-foreground">
                  Sort
                </Label>
                <select
                  id="sort"
                  name="sort"
                  defaultValue={sort}
                  className="h-10 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="name_asc">A → Z</option>
                  <option value="name_desc">Z → A</option>
                </select>
              </div>
              <Button type="submit" variant="secondary" className="h-10">
                Apply
              </Button>
            </form>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>
                          {c.firstName} {c.lastName}
                        </span>
                        {status === "archived" ? (
                          <Badge variant="secondary">Archived</Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{c.phone ?? "-"}</TableCell>
                    <TableCell>{c.email ?? "-"}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <EditCustomerDialog
                          customer={{
                            id: c.id,
                            firstName: c.firstName,
                            lastName: c.lastName,
                            phone: c.phone,
                            email: c.email,
                          }}
                        />
                        {status === "archived" ? (
                          <UnarchiveCustomerButton customerId={c.id} />
                        ) : (
                          <ArchiveCustomerButton customerId={c.id} />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center">
                      No customers yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 md:flex-row">
            <div className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{customers.length}</span>{" "}
              of <span className="font-medium text-foreground">{total}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button asChild variant="secondary" disabled={page <= 1}>
                <Link href={pageHref(Math.max(1, page - 1))}>Prev</Link>
              </Button>
              <div className="text-sm text-muted-foreground">
                Page <span className="font-medium text-foreground">{page}</span> of{" "}
                <span className="font-medium text-foreground">{totalPages}</span>
              </div>
              <Button asChild variant="secondary" disabled={page >= totalPages}>
                <Link href={pageHref(Math.min(totalPages, page + 1))}>Next</Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

