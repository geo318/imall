# Implementation Notes (WIP)

This document tracks the current implementation state and the next steps to finish the multi‑tenant shop. Keep it concise and update when flows are implemented.

## Scope & shape
- Tenants: path-based routing `/[shopSlug]/...`, roles via Clerk (start with a single admin/staff role).
- Catalog: products with markdown description, variants (price, SKU, stock), optional auctions (start/end, min increment, anti-snipe, buy-now).
- Cart/checkout: standard cart → order; manual shipping for now; payments start with keepz.me, add credo.com/bog.ge/tbcbank later.
- Inventory: ledger + snapshot; reserve on cart/checkout/auction bid, release on expiry/cancel; reconcile on order completion.
- Admin pane: manage shop settings (name, bank details, addresses), catalog, inventory, auctions, orders.

## Architecture direction (SOLID-friendly)
- Domain packages:
  - `@repo/db`: schema + migrations; thin data access layer (repositories per aggregate).
  - `@repo/shared`: cross-cutting constants/env/types.
  - `@repo/ui`: shadcn-based components (to replace stubs).
  - `@repo/core` (planned): domain services for products, inventory, cart/orders, auctions; keep logic here, not in transport.
- API (`apps/api`): Bun HTTP + WS; controllers delegate to domain services; request/response schemas via Zod; emit events for auctions/bids/inventory changes.
- Web (`apps/web`): Next.js with Tailwind + shadcn; server actions or API client calling API; per-tenant middleware for context.

## Payments & shipping (placeholders)
- Payments: start with keepz.me webhook/redirect flow; design provider interface so we can plug credo/bog/tbc next.
- Shipping: manual capture for now; design provider interface for tracking (trackings.ge/onway.ge).
- Store settlement: use bank details from shop settings; ledger entries for payouts (future).

## Auctions (minimal to ship)
1) Create auction per variant with start/end, min increment, optional buy-now, anti-snipe seconds.
2) Place bid: validate status, min increment, extend end if within anti-snipe, update current price/highest bid, emit WS event.
3) Close auction: job/cron to mark finished and create order/reservation; release inventory on failure.

## Admin pane (MVP)
- Shop settings: name, slug, domain, bank details, addresses.
- Catalog: CRUD product + markdown description, variants (price/currency/SKU), images, auction toggle + params.
- Inventory: adjust stock (ledger entry + optional snapshot update).
- Orders: list/detail; mark paid/shipped; manual shipping info.
- Roles: guard admin area; assume single admin until Clerk roles wired.

## Frontend direction
- Tailwind + shadcn base is installed; build shared UI kit in `@repo/ui`.
- Web app pages:
  - Public: home `/[shopSlug]`, product detail `/[shopSlug]/p/[productSlug]`, auction `/[shopSlug]/a/[auctionId]`, cart, checkout.
  - Admin: `/admin/[shopSlug]/...` sections above.
- Use `NEXT_PUBLIC_DOMAIN` to talk to API; add API client helpers; move to server components where possible.

## Dev workflow
- Env: root `.env` is the source of truth; `apps/web/next.config.js` force-loads it (prefers `@next/env`, falls back to `dotenv`) so Next picks up Clerk keys in dev/build. Env validation lives in `@repo/shared/src/env.ts` (required: `DOMAIN`, `DATABASE_URL`, `NEXT_PUBLIC_DOMAIN`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; optional: `CLERK_JWT_PUBLIC_KEY`). Rebuild shared after env schema changes (`cd packages/shared && bun run build`).
- Scripts: turbo for dev/build; drizzle-kit for migrations (`bun run db:generate` / `bun run db:push`).
- Migrations: generated from `packages/db/src/schema.ts`; keep migration SQL checked in (drizzle-kit 0.31.8 + drizzle-orm 0.45.x working).
- Tests: unit coverage started (env parsing, validation, UI utils); add integration tests against a test DB; e2e (Playwright/Cypress) planned after core flows stabilize.
- Formatting/linting: Biome configured (`bun run lint:biome` / `bun run format:biome`); prefer Biome over Prettier/ESLint where feasible.

## Meta
- AI agent log lives in `AGENTS.md`; update with rationale and non-obvious decisions when you change env/config/architecture.

## Immediate TODO
- Extend shadcn-based UI kit (add markdown editor, data table, modal).
- Finish API: auth guard (Clerk), inventory reservation flows (reserve/release), auction buy-now + status transitions, WS bid broadcasting + timers.
- Seed data script per tenant.
- Admin UI scaffolding + auth guard; wire UI to product/variant/cart/auction/order endpoints.
