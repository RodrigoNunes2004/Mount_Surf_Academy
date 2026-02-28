# Mount Surf Academy

Internal management platform for surf schools and equipment rental businesses.

---

## What We Design and Build Here

**Mount Surf Academy** is a multi-tenant internal operations platform for surf schools and equipment rental businesses. It provides:

- **Customer management (CRM)** — Create, edit, search, and archive customers with contact info and notes; paginated lists with filters and sorting.
- **Rental management** — Create rentals (legacy equipment or category-based variants like Softboard, Wetsuit, Hardboard); track status (Active, Returned, Overdue, Cancelled); process returns and cancellations.
- **Lesson booking management** — Schedule lesson bookings with time windows; assign customers, lessons, and optional equipment allocations; lifecycle (Booked → Checked in → Completed) with no-show handling.
- **Equipment inventory** — Manage categories and variants (e.g. sizes); track quantities and low-stock thresholds; view availability from active rentals; support for legacy per-item equipment.
- **Revenue tracking** — Today / week / month summaries; rental vs lesson breakdown; daily revenue chart (14 or 30 days); activity counts and averages.
- **Multi-tenant architecture** — Data scoped by business; users belong to a business and operate within that scope.
- **Authentication and roles** — Credential-based sign-in (NextAuth), JWT sessions, roles (Owner, Staff) with business-scoped access.

Built with Next.js 16, React 19, Tailwind, shadcn/ui, Prisma, and PostgreSQL (Neon).

---

## How This App Works and How to Use It

### How It Works

1. **Access** — Sign in at `/login`. Dashboard routes require authentication and redirect to login when there is no session.
2. **Navigation** — Use the sidebar to move between Dashboard, Customers, Rentals, Bookings, Equipment, and Revenue. Settings is at the bottom. The top bar shows the current user and logout.
3. **Data flow** — Pages load data in server components; actions call `/api/*` routes that use the session’s business ID for tenant scoping and Prisma for persistence.
4. **Actions** — Use "Add" buttons to create records. Tables offer row actions (Edit, Archive, Return, Check in, Complete, Cancel, No-show) depending on status.

### How to Use It

- **Dashboard** — Overview of customers, active rentals, today’s bookings, today’s revenue, and equipment out.
- **Customers** — Search (name, phone, email), filter (Active / Archived), sort (newest, oldest, A–Z, Z–A). Add, edit, archive, and unarchive.
- **Rentals** — Filter by Active, Returned, Cancelled, or History. Create rentals by selecting customer and equipment (category + variant or legacy). Return or cancel active rentals.
- **Bookings** — Create lesson bookings (customer, lesson, start/end, optional equipment). Filter by Booked, Completed, Cancelled, or History. Use Check in, Complete, Cancel, No-show.
- **Equipment** — Click a category (e.g. Softboard, Wetsuit, Hardboard) to view variants and quantities. Add categories and variants. Adjust quantities when buying or retiring equipment.
- **Revenue** — Today / week / month summaries, rental vs lesson revenue, activity counts, and a daily revenue chart. Toggle 14 or 30 days.
- **Logout** — Profile dropdown (top right) → Log out.

---

## Getting Started

1. Install dependencies and set up env vars (e.g. `DATABASE_URL`, `NEXTAUTH_SECRET`).
2. Run migrations: `npx prisma migrate dev`
3. Seed the database: `npm run db:seed`
4. Start the dev server: `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) and sign in.

**Seed credentials** (after `npm run db:seed`): `owner@mountsurf.local` / `ChangeMe123!`

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [NextAuth.js](https://next-auth.js.org)
