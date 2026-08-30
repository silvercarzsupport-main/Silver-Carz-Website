# Shared Architecture

Phase 1.5 locked the shared foundation every feature module builds on.
Authentication and authorization (login UI, sessions, profiles, RBAC helpers)
live in `@/lib/auth`, `features/auth`, `src/proxy.ts`, and
`supabase/migrations`. Phase 3.1 adds `vehicles` and `bookings` tables (schema
only — no CRUD UI yet).

See also:

- [Design system](./design-system.md) — multi-portal tokens, themes, component guidelines
- [Authentication](./authentication.md) — login, profiles, roles, RLS, permissions
- [Database](./database.md) — vehicles, bookings, ER diagram, indexes, RLS
- [Types & validation](./types-and-validation.md) — domain models, enums, Zod schemas
- [Bookings data layer](./bookings-data-layer.md) — repository, service, Server Actions
- [Invoice numbering](./invoice-numbering.md) — automatic SC-YYYY-XXXX allocation
- [Bookings list UI](./bookings-list.md) — `/bookings` table, search, filters, pagination
- [Create Booking UI](./bookings-create.md) — `/bookings/new` shared `BookingForm`
- [Edit Booking UI](./bookings-edit.md) — `/bookings/[id]/edit` reuses `BookingForm`
- [Vehicles data layer](./vehicles-data-layer.md) — repository, service, Server Actions
- [Vehicle Availability Engine](./vehicle-availability.md) — centralized availability states & sync
- [Booking Conflict Detection](./booking-conflict-detection.md) — schedule overlap engine
- [Booking Status Automation](./booking-status-automation.md) — lifecycle / badge engine
- [Booking Pricing Engine](./booking-pricing-engine.md) — centralized hire money math
- [Fleet Availability Calendar](./fleet-availability-calendar.md) — scheduling UI & occupancy
- [Admin Dashboard](./admin-dashboard.md) — post-login KPIs, charts, schedule, fleet snapshot
- [Vehicles list UI](./vehicles-list.md) — `/vehicles` fleet table, search, filters, pagination
- [Create Vehicle UI](./vehicles-create.md) — `/vehicles/new` Add Vehicle form + image upload
- [Edit Vehicle UI](./vehicles-edit.md) — `/vehicles/[id]/edit` reuses `VehicleForm`
- [Vehicle Details UI](./vehicles-details.md) — `/vehicles/[id]` fleet profile workspace
- [Pay at vehicle pickup](./pay-at-pickup.md) — booking vs payment status, Mark as Paid
- [Feature modules](../src/features/README.md) — how to add a domain module

## Folder structure

```
src/
├── app/                 # Next.js routes, layouts, global CSS, error/loading UI
├── components/
│   ├── ui/              # shadcn primitives (CLI-managed, token-driven)
│   ├── shared/          # Business-agnostic composites (EmptyState, PageHeader, …)
│   ├── layout/          # Admin app shell (sidebar, header)
│   └── customer/        # Customer portal chrome (header, footer, nav)
├── features/            # Domain modules (auth login UI; others as built)
├── config/              # App identity, portal theme, formatting, navigation
├── constants/           # Routes, storage keys, color-mode, pagination, table defaults
├── themes/              # Portal design tokens (admin / vendor / customer)
├── types/               # Shared TypeScript contracts
├── lib/                 # Utilities, auth, formatting, errors, Supabase infra
├── validations/         # Reusable Zod schemas and helpers
├── services/            # Service result helpers + repository contracts
├── hooks/               # Generic React hooks
├── providers/           # Portal theme, TanStack Query, provider composition
└── proxy.ts             # Next.js Proxy — session refresh + auth redirects
```

## Design principles

1. **Thin routes** — `app/` composes feature UI; no business logic in pages.
2. **Feature isolation** — domain code lives in `features/<name>/`. Promote to
   shared folders only when two or more features need the same abstraction.
3. **No hardcoded paths** — always use `ROUTES` from `@/constants`.
4. **No hardcoded app defaults** — names, currency, date formats, and page
   sizes come from `@/config` / `@/constants`.
5. **Normalized errors** — never format raw infrastructure errors in UI code.
6. **Named exports** — prefer named exports; default exports only where Next.js
   requires them (pages/layouts/error/loading/not-found).
7. **Server Components by default** — `'use client'` only when required.

## How future modules should use the shared layer

### Config (`@/config`)

```ts
import { appConfig } from '@/config';

appConfig.name; // "Silver Carz"
appConfig.currency; // "INR"
appConfig.dateFormat; // "dd MMM yyyy"
```

### Constants (`@/constants`)

```ts
import { ROUTES, PAGINATION, STORAGE_KEYS, THEME } from '@/constants';

router.push(ROUTES.bookings);
const pageSize = PAGINATION.defaultPageSize;
```

### Types (`@/types`)

Use shared contracts for list/API surfaces and domain models:

- `ApiResponse<T>` — success/failure envelope
- `PaginatedResult<T>` / `ListQueryParams` — list queries
- `BaseEntity` / `TimestampFields` — persisted records
- `SelectOption` / `SortOrder` / `TableColumn` — UI building blocks
- `Vehicle` / `Booking` — aliases of generated Supabase table types
- Enums — `FuelType`, `BookingStatus`, `PaymentMethod`, `RentalMode`, `UserRole`

Generated schema types live in `database.ts`. See
[types-and-validation.md](./types-and-validation.md).

Feature modules re-export shared domain types from `features/<name>/types`
for convenience; do not redefine the same interfaces there.

### Utilities (`@/lib`)

| Module       | Purpose                                                          |
| ------------ | ---------------------------------------------------------------- |
| `utils`      | `cn()` className merge (shadcn convention)                       |
| `format`     | `formatDate`, `formatDateTime`, `formatCurrency`, `formatNumber` |
| `string`     | `capitalize`, `toTitleCase`, `truncate`, `isBlank`, …            |
| `debounce`   | generic debounce helper                                          |
| `pagination` | `createPaginatedResult`, `normalizePaginationParams`, `toOffset` |
| `errors`     | `AppError`, `toAppError`, `getDisplayErrorMessage`               |
| `auth`       | session, profiles, RBAC helpers, requireAuth/Role, signOut       |
| `supabase`   | clients, config, Supabase-specific error normalization           |

### Services (`@/services`)

```ts
import { fromPromise, ok, fail, type Repository } from '@/services';
import type { ApiResponse } from '@/types';

// Public service methods return ApiResponse<T>
export async function getThing(id: string): Promise<ApiResponse<Thing>> {
  return fromPromise(async () => repository.findById(id));
}
```

- Implement domain repositories against `Repository` / `ReadRepository`.
- Wrap side effects with `fromPromise` / `ok` / `fail`.
- Do **not** put SQL, Supabase queries, or domain rules in `src/services/`.
  Those belong in feature modules.

### Validations (`@/validations`)

Compose shared Zod primitives (`emailSchema`, `phoneSchema`, `moneySchema`,
`createBookingSchema`, …). Auth credential schemas stay in
`features/auth/validations`. Prefer `@/validations` for booking/vehicle rules
so forms, Server Actions, and API routes share one definition.

### Hooks (`@/hooks`)

Generic only: media query, mounted, debounce, window size, local storage,
theme. Domain hooks belong in the feature that owns them.

### Providers (`@/providers`)

`AppProviders` is the single composition root used by `app/layout.tsx`.
Today it wires:

1. Theme (`next-themes`)
2. TanStack Query
3. Tooltip provider

Auth session state is cookie-based (Supabase SSR) — no client Auth provider
is required for Server Components. Add a client auth provider here only if
a future UI needs live `onAuthStateChange` subscriptions.

## Shared components — when to use

| Use `components/shared/` when…                     | Do **not** put in shared when…             |
| -------------------------------------------------- | ------------------------------------------ |
| The UI is domain-agnostic (EmptyState, PageHeader) | It mentions bookings, vehicles, customers… |
| Two or more features need the same composite       | Only one feature needs it (keep it local)  |
| It improves layout consistency across modules      | It is a one-off screen section             |

Start local in `features/<name>/components`. Promote only after a second
consumer appears. Never force abstraction early.

## Adding a future module

1. Create `src/features/<name>/` using the layout in
   [`src/features/README.md`](../src/features/README.md).
2. Add the route under `src/app/(app)/<route>/page.tsx` — page only composes
   feature UI.
3. Register the path in `ROUTES` (`@/constants/routes`) and navigation
   (`@/config/navigation`) if it belongs in the sidebar.
4. Implement services that return `ApiResponse<T>`; keep Supabase access behind
   `@/lib/supabase/*`.
5. Compose Zod schemas from `@/validations` for shared field rules.

No restructuring of the shared layer should be required for Authentication or
Booking CRUD — those plug into this shape.

## Error handling flow

```
unknown error
  → toAppError() / normalizeSupabaseError()
  → fail() → ApiResponse failure
  → UI reads response.error.message / ErrorState / toast
```

- App-wide: `@/lib/errors`
- Supabase-specific: `@/lib/supabase/errors`
- Service boundary: `@/services` (`ok` / `fail` / `fromPromise`)
- Route boundary: `app/(app)/error.tsx`

## Server / client boundaries

- Prefer Server Components. Mark client boundaries at the smallest leaf that
  needs interactivity (hooks, event handlers, browser APIs).
- Providers live under `src/providers/` and are composed once in the root layout.
- Supabase: browser → `@/lib/supabase/client`; server → `@/lib/supabase/server`;
  proxy session refresh → `@/lib/supabase/middleware` (via `src/proxy.ts`).
- Auth: server helpers → `@/lib/auth`; see [authentication.md](./authentication.md).

## What remains for later phases

- Customer / driver normalization (still denormalized on bookings for MVP)
- Admin user-management UI (profiles list / role edits)
- Calendar year view and drag-and-drop scheduling (see fleet calendar doc)

Those arrive on top of this foundation.
