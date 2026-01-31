# Agents Notes

This file is a lightweight log for AI copilots. Keep entries terse and update when making changes future maintainers should know.

## Current context

- Monorepo root `.env` is the source of truth. `apps/web/next.config.js` force-loads it (prefers `@next/env`, falls back to `dotenv`) so Next dev/build picks up Clerk keys even when hoisted.
- Env validation lives in `packages/shared/src/env.ts` with an explicit `runtimeEnv` map and `isServer` flag so browser bundles receive the `NEXT_PUBLIC_*` values. Missing required keys crash early. Required: `DOMAIN`, `DATABASE_URL`, `NEXT_PUBLIC_DOMAIN`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; `CLERK_JWT_PUBLIC_KEY` is optional.
- After env code changes, rebuild shared: `cd packages/shared && bun run build` (usually handled by turborepo during dev/build).

## Recent changes

- Added Render-aware build/start routing via `scripts/render.mjs` and updated root scripts to build/start only the matching service (web vs api) based on `RENDER_SERVICE_NAME`.
- Render start now optionally runs `db:push` before boot when `RUN_MIGRATIONS` is enabled (intended for the API service).
- Added `Dockerfile.api`, `Dockerfile.web`, and a root `.dockerignore` for Render Docker deployments.
- Removed package-level `prepare` scripts for `@repo/shared` and `@repo/db` to prevent install-time builds in Docker/Render.
- Dockerfiles now pin Bun 1.3.0 to match the repo `packageManager` and avoid frozen lockfile drift.
- Dockerfiles now copy both app package manifests so Bun workspace install matches the lockfile.
- Admin API proxy now prefers `BACKEND_URL` (server-side) before falling back to `NEXT_PUBLIC_BACKEND_URL`.
- Added `render.yaml` to define Render Docker services for API and web.
- Render blueprint now uses `hostport` for `BACKEND_URL`, and server-side env handling prepends `http://` when a scheme is missing.
- Image URL helper now normalizes backend base URLs that omit a scheme.
- Hardened Clerk auth for bids: Next proxy now forwards existing Authorization headers, falls back to Clerk session (`getToken` with `integration_fallback`, then `__session` cookie), and backend auth plugin trims/validates tokens (Clerk verifyToken with clock skew tolerance; no default admin role). Cart routes register the auth plugin directly (global auth plugin removed to avoid double runs). Typed cart params for TS and `bun tsc --noEmit` now passes.
- Proxy middleware matcher excludes Next internals (`/_next/*`, dev stack frame) to avoid blocking the dev server.
- Implemented proper Clerk backend authentication using `@clerk/backend` SDK. The `authPlugin` in `apps/api/src/context.ts` verifies Clerk JWT tokens (Clerk backend helper) extracting `userId`, `sessionId`, `orgId`, and other claims from verified tokens. Updated `AuthContext` type to match Clerk's Auth object structure. Added authorization checks to cart routes to ensure users can only access their own carts (guest carts remain accessible via cartId). Frontend already correctly sends tokens via Next.js proxy route. Removed demo header fallback authentication - all requests now require valid Clerk JWT tokens.
- Tightened Clerk env validation (server + client) and wired `ClerkProvider` to the validated env.
- Added monorepo-root env loading for the web app with a fallback to avoid `@next/env` missing-module errors when hoisted.
- Fixed browser-side env validation failures by feeding a curated `runtimeEnv` into `createEnv` and explicitly setting `isServer`.
- Typed product seed variants and guarded optional auctions in `scripts/seed.ts` so optional auctions stay lint-clean.
- Corrected `apps/api` dev/start scripts to run the source/built files directly with `bun --env-file`, which keeps `bun dev:api` from exiting immediately.
- Replaced `[shopSlug]/page.tsx` with a vendor profile layout powered by `ShopProfileClient` (tabs, stats, auction/products grid) and removed the unused `ShopProductsClient`.
- Wired TanStack React Query into the web app (provider in `app/layout.tsx`) with API helpers in `apps/web/lib/api` and mapping in `apps/web/lib/marketing.ts`; product/marketing pages now fetch on the client, using picsum-backed assets in `apps/web/assets`.
- Refreshed marketing surface (home/products/about/vendors/faq) so cards link to `/[shopSlug]/[productSlug]` (old `/p/` redirects) and vendor promos link to `/[shopSlug]`; seed data slugs align with those links.
- Added `/api/products` (randomized) so marketing/product grids can pull products across tenants without relying on env defaults; `/api/shops` exists for listing tenants. API product detail now attaches auctions per variant; CORS is handled via a manual preflight handler in `apps/api/src/index.ts`.
- Implemented Clerk Elements-based authentication with Google and Facebook OAuth support. Created reusable SVG icon components (`GoogleIcon`, `FacebookIcon`) in `app/(auth)/_components/`. OAuth buttons trigger redirect-based authentication flow.
- Fixed ClerkProvider integration: Created `ClerkContextProvider` with `ClerkReadyContext` to ensure Clerk Elements only render after Clerk is fully initialized. Wrapped in Suspense boundary in layout to prevent navigation blocking.
- Separated `MarketingNav` into client wrapper (`MarketingNavClient`) that uses Clerk hooks, wrapped in Suspense in `app/page.tsx` to prevent blocking. Fixed `Copyright` component to use `"use cache"` directive for static year rendering.
- Fixed auth page layout: Left branding panel and right form panel now both scroll independently (`overflow-y-auto`) instead of left panel being sticky.
- Refactored token handling: Created reusable token utilities (`extractTokenFromHeader`, `verifyClerkToken`) in `apps/api/src/utils/token.ts` for consistent token extraction and verification. Simplified `authPlugin` to use these utilities. Kept manual token verification fallback in auction routes since authPlugin doesn't always run reliably.
- Improved auction bidding UX: Implemented standard bid increments (avoid fractional steps), auto-populate bid input on first mount, added green styling to timer block when user is winning. Replaced polling with WebSocket for real-time updates.
- Removed redundant logging: Cleaned up excessive `console.log` statements, using `logger` utility for environment-aware logging instead.
- Added admin catalog editing experience plus sharing/favorites telemetry: the admin catalog cards/form now call the backend via new admin API proxies (products, uploads), and product/favorites UI gained header favorites, share slot, view tracker, and Next API routes backed by the backend favorites/webhooks.
- Added shop settings, inventory, and orders sections to the admin workspace along with backend proxies so merchants can view/update their tenant metadata, stock, and recent orders via the new admin routes.
- Introduced a `shop_settings` schema + migration so tenants can persist bank/payout/order/inventory metadata dynamically and drive the admin UI sections.
- Expanded admin APIs: orders now support PATCH updates, inventory routes accept reserve/release actions, and shop settings exposes discrete banking/payout/order/inventory fields plus forms for each setting area.
- Admin catalog now supports per-variant stock inputs (non-auction), auction mode locks to a single variant and disables stock, and the product list is a compact searchable/sortable table with stock and auction indicators; the standalone inventory page was removed.
- Catalog list now debounces search, paginates after 15 items, shows variant overview modal from price/stock cells, and uses stable variant keys to keep SKU edits responsive.
- Admin dashboard now removes the implementation notes/auctions card, adds a shop overview with sales, inventory health, charts, and recent orders, and orders page shows Shopify-style mock fulfillment data when no real orders exist.
- Added finance/returns/shipping/customer tables + migration, expanded admin shop routes to cover payouts/ledger, returns, shipping profiles, fulfillment rules, and customers (segments/messages), and added admin pages with mock fallback for those sections plus a generic admin proxy route.
- Fixed admin shop routes to coerce numeric payloads to strings for Drizzle numeric columns and replaced deprecated `_infer` usage with `$inferInsert` for update typings.
- Fixed admin product form typing by casting the zod resolver to the form data type to keep React Hook Form and schema defaults aligned.
- Admin catalog list now detects auction products via `hasAuction` or variant auction data (no `isAuction` field on API type).
- Guarded mock order updates to ensure a status is selected before updating rows (avoids undefined status typing).
- Mock order generator now falls back to a default status when indexing mock status list.
- Admin shop overview now types optional product stats locally to safely compute units sold.
- Mock returns generator now falls back to a default status when indexing mock status list.
- Added missing backend error helper to the admin inventory API route.
- Switched admin API proxy helper to use a `Headers` instance to avoid TypeScript indexing errors.
- Updated shared env test import to include explicit `.js` extension for NodeNext module resolution.
- Server-side shop fetch now returns an empty list instead of throwing when the API is unreachable (avoids build failures without the API).
- Server-side product fetchers now return empty results on connection failures to allow Next builds without the API running.

## Known gaps / follow-ups

- Ensure all environments set the required Clerk keys; browser fails fast otherwise.
- When adding new public env vars, extend `clientSchema` and the `runtimeEnv` map in `packages/shared/src/env.ts`.
- If Next is upgraded and `@next/env` behavior changes, re-check `apps/web/next.config.js` to keep root `.env` loading intact.
- Web grids/detail pages depend on the API at `NEXT_PUBLIC_DOMAIN`; run `bun run dev:all` and seed the DB to avoid connection errors in dev.
- Vendor names in marketing/shop cards currently use slug/env fallbacks until the API exposes tenant metadata.
- Admin sections for payouts, returns, shipping, and customers still use mock fallback in the UI; wire to live workflows and add operator forms once the underlying business flows are finalized.
- Orders: replace mock fulfillment + line items with real API data once order item/fulfillment endpoints are implemented.

## Critical Dos and Don'ts

### Authentication & Tokens

**DO:**

- Use `getToken()` without parameters in client components (no template)
- Use token utilities (`extractTokenFromHeader`, `verifyClerkToken`) for consistent handling
- Keep manual token verification fallback in auction routes (authPlugin doesn't always run)
- Handle malformed tokens (5+ parts) by extracting first 3 parts
- Use single `Authorization` header (not both `authorization` and `Authorization`)

**DON'T:**

- Never use `getToken({ template: "default" })` - Clerk doesn't have a "default" template
- Don't set both `authorization` and `Authorization` headers (causes concatenation)
- Don't assume authPlugin always populates auth context - always have fallback

### Auction Bidding

**DO:**

- Use standard bid increments (`calculateNextMinBid`) - avoid fractional steps
- Auto-populate bid input on first mount with minimum bid amount
- Use WebSocket (`useAuctionWebSocket`) for real-time updates, not polling
- Track winning state via WebSocket messages and show green timer when user is winning
- Format bid amounts to 2 decimal places

**DON'T:**

- Don't use fractional increments ($0.50) - use standard patterns ($1, $5, $10, etc.)
- Don't poll when WebSocket is available
- Don't update state unnecessarily - use refs to track changes

### Performance & State

**DO:**

- Use `useRef` to track previous values and prevent unnecessary updates
- Memoize callbacks with `useCallback` to prevent infinite loops
- Separate initialization from updates with different `useEffect` hooks
- Use `React.memo` for expensive components like timers
- Only update timer state when displayed value actually changes

**DON'T:**

- Don't include `setState` functions in dependency arrays (they're stable)
- Don't update state on every render - check if values changed first
- Don't create new objects/arrays in render that cause rerenders

### Logging

**DO:**

- Use `logger` utility from `apps/api/src/utils/logger.ts` for environment-aware logging
- Keep essential error logs for debugging production issues

**DON'T:**

- Don't use `console.log` in production - use `logger.debug()` which only logs in dev
- Don't log sensitive data (tokens, passwords)
- Remove redundant logs that don't add value

### Common Issues

**Token has 5 parts instead of 3**: Use `extractTokenFromHeader()` which extracts first 3 parts

**authPlugin doesn't populate auth**: Keep manual verification fallback in critical routes

**Infinite useEffect loops**: Use refs to track previous values, memoize callbacks, stable dependencies

**Bid input empty on first load**: Use separate `useEffect` for initialization with `initializedRef`

**Timer rerenders too frequently**: Only update when displayed value changes, use `React.memo`

## How to use this log

- Append bullets under “Recent changes” and “Known gaps / follow-ups” as you modify behavior.
- Capture rationale for non-obvious decisions (monorepo env loading, explicit runtime env mapping) so future agents know why it’s structured this way.
