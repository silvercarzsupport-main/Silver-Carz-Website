# Silver Carz — Rental Management System

Customer booking portal and staff admin for **Silver Carz** (Nagpur, Maharashtra). Customers browse cars, request bookings, and upload documents. Owners and Managers review documents, approve or deny requests, and record payment collected at vehicle pickup. There is no online payment gateway.

> **Current workflow:** city and dates → vehicle → account → request → documents → admin approval (vehicle reserved) → pay at pickup → admin **Mark as Paid**. Email and WhatsApp notifications go through a durable outbox.

See [docs/pay-at-pickup.md](./docs/pay-at-pickup.md) for booking status versus payment status.

## Tech Stack

| Concern         | Technology                                                     |
| --------------- | -------------------------------------------------------------- |
| Framework       | [Next.js](https://nextjs.org) 16 (App Router)                  |
| Language        | TypeScript (strict mode)                                       |
| Styling         | Tailwind CSS v4 (CSS-based configuration)                      |
| UI components   | [shadcn/ui](https://ui.shadcn.com) (Radix base, CSS variables) |
| Icons           | Lucide React                                                   |
| Validation      | Zod                                                            |
| Forms           | React Hook Form                                                |
| Tables          | TanStack Table                                                 |
| Notifications   | Sonner                                                         |
| Theming         | next-themes (light default, system supported, dark prepared)   |
| Backend         | Supabase (PostgreSQL, Auth, Storage)                           |
| Dates           | date-fns                                                       |
| Package manager | pnpm 10                                                        |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+ (`corepack prepare pnpm@10 --activate`)

### Setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment variables
cp .env.example .env.local
# then fill in your Supabase project values

# 3. Start the dev server
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Script              | Purpose                            |
| ------------------- | ---------------------------------- |
| `pnpm dev`          | Start the development server       |
| `pnpm build`        | Production build                   |
| `pnpm start`        | Serve the production build         |
| `pnpm lint`         | Run ESLint                         |
| `pnpm lint:fix`     | Run ESLint with auto-fix           |
| `pnpm typecheck`    | TypeScript type checking (no emit) |
| `pnpm format`       | Format the codebase with Prettier  |
| `pnpm format:check` | Verify formatting without writing  |

A Husky pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files) and a full typecheck before every commit.

## Folder Structure

```
src/
├── app/                  # Next.js App Router — routing, layouts, global CSS only
├── components/
│   ├── ui/               # shadcn/ui primitives (generated via CLI)
│   ├── shared/           # Reusable business-agnostic composites
│   └── layout/           # App shell components (sidebar, header, …)
├── features/             # Feature modules — each domain owns its UI + logic
├── config/               # App identity, formatting defaults, navigation
├── constants/            # Routes, storage keys, theme, pagination, table defaults
├── types/                # Shared TypeScript contracts (API, pagination, entities)
├── lib/
│   ├── auth/             # Session, profiles, RBAC helpers, guards, errors
│   ├── supabase/         # Supabase infrastructure (clients, config, errors)
│   ├── utils.ts          # cn() classname helper
│   ├── format.ts         # Date / currency / number formatting
│   ├── string.ts         # String helpers
│   ├── debounce.ts       # Debounce helper
│   ├── pagination.ts     # Pagination helpers
│   └── errors.ts         # AppError + display-message helpers
├── proxy.ts              # Next.js Proxy — Supabase session refresh
├── validations/          # Reusable Zod schemas and parse helpers
├── services/             # ApiResponse helpers + repository contracts
├── hooks/                # Shared generic React hooks
└── providers/            # Theme, TanStack Query, AppProviders composition
supabase/migrations/      # SQL migrations (profiles, vehicles, bookings, RLS)
docs/                     # Architecture, auth, database, conventions
public/                   # Static assets (icons, manifest)
```

Conventions:

- **Feature isolation** — everything specific to one domain lives in its `features/<name>/` module. Anything used by two or more features is promoted to `components/shared/` or `lib/`.
- **Thin routes** — files in `app/` only compose feature components; no business logic in pages.
- **Centralized routes & config** — never hardcode paths or app defaults; use `@/constants` and `@/config`.
- **`components/ui/` is CLI-managed** — add primitives with `pnpm dlx shadcn@latest add <component>`; never hand-edit business terms into them.
- Global styles live in `src/app/globals.css` (Tailwind v4 configures theme tokens in CSS; there is no `tailwind.config.ts`).

## Architecture Summary

| Layer       | Location           | Use for                                                       |
| ----------- | ------------------ | ------------------------------------------------------------- |
| Config      | `src/config/`      | App name, company, version, locale, currency, date formats    |
| Constants   | `src/constants/`   | `ROUTES`, storage keys, theme, pagination/table defaults      |
| Types       | `src/types/`       | `ApiResponse`, pagination, `BaseEntity`, table/select helpers |
| Utilities   | `src/lib/`         | Formatting, strings, debounce, pagination, `AppError`         |
| Validations | `src/validations/` | Shared Zod primitives (`emailSchema`, `paginationSchema`, …)  |
| Services    | `src/services/`    | `ok` / `fail` / `fromPromise`, `Repository` contracts         |
| Hooks       | `src/hooks/`       | Media query, debounce, local storage, window size, theme      |
| Providers   | `src/providers/`   | `AppProviders` (theme + React Query + tooltips)               |

Rules for upcoming feature work:

- Return `ApiResponse<T>` from service methods; convert failures with `toAppError` / `fail`.
- Put domain schemas under `features/<name>/validations`, composing shared primitives.
- Import routes from `ROUTES` — do not hardcode path strings in features.
- Keep `src/services/` generic; domain repositories and queries live with their feature.

Deep dives:

- [docs/architecture.md](./docs/architecture.md) — shared layer usage, module guide, error flow
- [docs/authentication.md](./docs/authentication.md) — auth session flow, proxy, roles, RLS
- [docs/database.md](./docs/database.md) — vehicles & bookings schema, ER, indexes, RLS
- [docs/types-and-validation.md](./docs/types-and-validation.md) — domain models, enums, Zod
- [docs/bookings-data-layer.md](./docs/bookings-data-layer.md) — booking repository / service / actions
- [docs/booking-conflict-detection.md](./docs/booking-conflict-detection.md) — schedule conflict engine
- [docs/bookings-list.md](./docs/bookings-list.md) — booking list table UI
- [docs/bookings-create.md](./docs/bookings-create.md) — create booking form UI
- [docs/vehicles-data-layer.md](./docs/vehicles-data-layer.md) — vehicle repository / service / actions
- [docs/vehicle-availability.md](./docs/vehicle-availability.md) — fleet availability engine
- [docs/vehicles-list.md](./docs/vehicles-list.md) — fleet list UI
- [docs/vehicles-create.md](./docs/vehicles-create.md) — add vehicle form UI
- [docs/vehicles-edit.md](./docs/vehicles-edit.md) — edit vehicle form UI
- [docs/conventions.md](./docs/conventions.md) — naming, git, imports, TypeScript
- [src/features/README.md](./src/features/README.md) — feature folder layout

## Coding Standards

- TypeScript strict mode; `any` is disallowed.
- Named exports preferred (default exports only where Next.js requires them).
- Functional components and `async/await` only.
- Server Components by default; `'use client'` only when needed.
- `no-console` enforced (`console.warn`/`console.error` allowed).
- Formatting is Prettier-owned: single quotes, semicolons, trailing commas, 100-char width, Tailwind class sorting.
- Path alias `@/*` maps to `src/*`. Prefer barrels (`@/config`, `@/constants`, …) over deep relative paths.

## Development Workflow

1. Create a branch from `main` using the naming rules in [docs/conventions.md](./docs/conventions.md).
2. Implement inside the correct layer (`features/` for domain work; shared folders only when reused).
3. Run locally:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm format:check
   pnpm build
   ```
4. Commit with Conventional Commits. Pre-commit hooks enforce lint, format, and typecheck.
5. Open a PR against `main`. Keep PRs focused and reviewable.

## Environment Variables

All variables are documented in [`.env.example`](./.env.example). Never commit real values; `.env*` files are git-ignored (except the example template).

| Variable                        | Purpose                             |
| ------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous (public) API key |

Both values are found in your Supabase dashboard under **Project Settings → API**. They are client-safe by design — Row Level Security (added in a later phase) is the actual security boundary. Service role keys must **never** be added to this project.

Environment validation is fail-fast: if a variable is missing, the app throws a descriptive error at startup instead of failing mysteriously at runtime.

## Supabase Infrastructure

All Supabase access goes through `src/lib/supabase/`. **Never import from `@supabase/supabase-js` or `@supabase/ssr` directly** — this keeps every Supabase touchpoint centralized and swappable.

| File            | Use it in                                         | Purpose                                                                          |
| --------------- | ------------------------------------------------- | -------------------------------------------------------------------------------- |
| `client.ts`     | Client Components only                            | Browser client (`createSupabaseBrowserClient`)                                   |
| `server.ts`     | Server Components, Server Actions, Route Handlers | Per-request server client bound to cookies (`createSupabaseServerClient`)        |
| `middleware.ts` | Next.js Proxy (`src/proxy.ts`)                    | `updateSession()` — refresh auth cookies before the App Router runs              |
| `config.ts`     | Anywhere                                          | Validated environment configuration (`supabaseConfig`)                           |
| `errors.ts`     | Anywhere                                          | Error normalization — raw DB errors are never shown to users                     |
| `health.ts`     | Server only, temporary                            | `checkSupabaseConnection()` pings the auth health endpoint; safe to delete later |
| `index.ts`      | Anywhere                                          | Barrel for runtime-agnostic exports (config, errors, `TypedSupabaseClient`)      |

### Authentication & authorization (`src/lib/auth/`)

Server helpers for session, profiles, and RBAC. See [docs/authentication.md](./docs/authentication.md).

| Concern       | API                                                                                    |
| ------------- | -------------------------------------------------------------------------------------- |
| Current user  | `getCurrentUser`, `getCurrentProfile`, `getAuthState`, `isAuthenticated`               |
| Roles / RBAC  | `hasRole`, `isOwner`, `isManager`, `hasPermission`, `requireRole`, `requirePermission` |
| Guards        | `requireUser` / `requireProfile` (throw), `requireAuth` (redirect)                     |
| Sign out      | `signOut`                                                                              |
| Errors        | `toAuthError`, inactive / missing profile / session-expired helpers                    |
| Route helpers | `isPublicRoute`, `getRouteAccess`, `allowsRouteAccess`, …                              |

Apply migrations under `supabase/migrations/` in order before relying on profiles or bookings in production (see [docs/database.md](./docs/database.md)).

Usage rules for future modules:

- Server code imports `@/lib/supabase/server`; client code imports `@/lib/supabase/client`. The wrong import fails at build time (`server-only` guard / `use client` directive).
- Create the server client **per request** — never cache it in a module-level variable.
- Shared, runtime-agnostic helpers come from the barrel: `import { getErrorMessage } from '@/lib/supabase'`.
- Authorize with `@/lib/auth` helpers — do not hardcode role checks in feature modules.
- Database types live in `src/types/database.ts` (`profiles`, `vehicles`, `bookings`). Regenerate with `supabase gen types typescript` after schema changes.

To verify connectivity after configuring `.env.local`, temporarily call `checkSupabaseConnection()` from any Server Component and check the returned status.

## Deployment Notes

- Target platform: **Vercel** (zero-config for Next.js).
- Set environment variables per environment in the Vercel dashboard — no environment logic in code.
- Use separate Supabase projects for development, staging, and production.
- Production deploys from `main` only; rollback via Vercel's instant redeploy of a previous build.
- Node.js 20+ is required (`engines` in `package.json`).

## Contribution Guidelines

This project will be maintained by a small internal team. Before contributing:

1. Read [docs/architecture.md](./docs/architecture.md) and [docs/conventions.md](./docs/conventions.md).
2. Match existing patterns — do not introduce parallel abstractions.
3. Keep PRs small: one concern per branch.
4. Do not commit secrets, `.env.local`, or generated build output.
5. Do not add business logic into `components/ui/`, `lib/supabase/`, or shared barrels unless it is truly cross-cutting.
6. Prefer extending existing helpers (`ApiResponse`, `AppError`, shared Zod schemas) over inventing new response/error shapes.
7. When adding UI primitives, use the shadcn CLI rather than hand-rolling Radix wrappers.

Questions about structure should be resolved in favor of **feature isolation** and **thin routes**.
Pr@roop19912
