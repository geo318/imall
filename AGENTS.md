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
- Dockerfile.web now includes `packages/db/package.json` to keep Bun workspace resolution local.
- Fixed relative import path for `resolveBackendBase` in the admin image upload API route.
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
- Sign-in/sign-up OAuth buttons now only use Clerk's `oauth_google` strategy (removed plain `google` fallback) to avoid invalid OAuth redirects missing `client_id`.
- Login page now shows both Google and Facebook OAuth buttons and uses Clerk `oauth_google` / `oauth_facebook` strategies.
- Header UX updated: removed desktop "Start selling" CTA, show "Sign in" button for guests, and show `Hi, {username}` before the account icon for signed-in users.
- OAuth redirect flow now uses a dedicated locale-aware callback route (`/[locale]/sso-callback`) via `AuthenticateWithRedirectCallback` to avoid locale-redirect interference with session completion.
- Proxy middleware treats `/sso-callback` as a public route so OAuth completion isn't blocked by auth redirects.
- Added tabbed legal hub page at `/[locale]/legal` backed by locale markdown files in `apps/web/content/legal/{en,ka,ru}`, with footer legal links pointing to tab query params.
- Replaced legal placeholder markdown with full EN/KA/RU policy content (overview, return/cancellation, terms, privacy, translated terms, contact) and set deterministic section order in `apps/web/lib/legal.ts`.
- Updated public branding surface to use iMall logo/wordmark in footer and auth pages, refreshed sticky header with glass/backdrop styling, and redesigned FAQ page as a hero + accordion with updated EN/KA/RU copy.
- Refined iMall monogram SVG icon, tuned header transparency/backdrop saturation, and restyled legal page (hero + glass tabs + polished markdown panel) to match the updated public design language.
- Imported the exact `shop-spark` iMall logo image into `apps/web/public/imall-logo.png`, switched `MarketHubLogo` to render that asset, aligned header transparency classes to `shop-spark`, and updated legal hero/tabs styling to match the same visual system.
- Legal tabs now follow `shop-spark` Legal page styling more closely: compact segmented tab rail, icon/title header per section, and animated content area with structured prose typography.
- Legal content was aligned closer to `shop-spark` body copy: concise Privacy/Terms/Refund sections in EN and a new Cookies policy tab/content (EN/KA/RU), with legal section ordering updated to `privacy -> terms -> cookies -> refund` first.
- About page now mirrors `shop-spark` structure (hero, stats, mission, values, CTA) with iMall-focused copy in EN/KA/RU and localized messaging that reflects the marketplace + auction concept.
- Header now uses a `shop-spark`-style categories mega menu (`apps/web/components/mega-menu.tsx`) with desktop hover panel + mobile accordion, removed Products/FAQ links from header, moved categories trigger right after logo, and wired category query (`?category=`) into products explorer state.
- Fixed iMall logo asset serving in Next by switching logo source to `/imall-logo.jpg` (the imported file bytes are JPEG; using `.png` extension caused `next/image` "isn't a valid image" errors and broken header icon).
- Proxy middleware now bypasses static assets (`/public` files with extensions) and matcher excludes `.*\\..*`; this prevents locale redirects from rewriting image URLs like `/imall-logo.jpg` to `/{locale}/...` and breaking `next/image`.
- Converted `apps/web/public/imall-logo.png` to a real PNG file, pointed `MarketHubLogo` back to `/imall-logo.png`, and set locale layout metadata icons (`icon/shortcut/apple`) to use the same PNG as favicon.
- Replaced `apps/web/app/favicon.ico` (default Vercel icon) with an iMall-based ICO that embeds a 256x256 PNG image.
- Removed `apps/web/app/favicon.ico` (was failing Next image decoding) and switched to `apps/web/app/icon.png` using the iMall logo so App Router serves the custom site icon without ICO decode issues.
- Finalized app icon setup per Next App Router file-convention guidance: restored `apps/web/app/favicon.ico` using the RGBA favicon from `shop-spark/public/favicon.ico` (keeps transparency), removed `apps/web/app/icon.png`, and dropped explicit `metadata.icons` overrides so Next uses `app/favicon.ico`.
- Replaced app icons with a generated transparent circle-`i` brand mark: `apps/web/app/icon.png` (512 RGBA) and `apps/web/app/favicon.ico` (256 RGBA PNG-in-ICO), keeping App Router file conventions and transparency intact.
- Categories are now DB-driven end-to-end: added category i18n fields (`category_key`, `name_en/ka/ru`, `icon`) in schema + migration, exposed public `/api/categories/tree?locale=...`, wired header mega menu + product filters + admin product form to live categories, and expanded superadmin category CRUD forms/APIs to manage key/icon/translations.
- Legal tabs now hide `translated-terms` (removes duplicate Terms-like tab), and user-facing hardcoded copy in header/menus/legal tabs/shop product loading states was moved into locale message JSON (en/ka/ru) with Georgian wording revisions.
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
- Added `next-intl` dependency to the web app; Clerk Elements sign-in/up now respect locale-prefixed paths and OAuth redirects.
- Sell page is forced dynamic (`noStore`) and middleware now resolves auth for public routes so authenticated users aren’t mis-redirected.
- Product explorer empty-state and result-count copy now comes from translations (en/ka/ru).
- Replaced Next middleware usage with `apps/web/proxy.ts` for auth + locale handling; removed `apps/web/middleware.ts`.
- Added `SUPERADMIN_*` env entries to `.env` and `.env.example`.
- Fixed Drizzle meta snapshot chain: `0011_snapshot.json` now points to `0010` and has a unique snapshot id.
- Switched server components/pages from `useTranslations` to `getTranslations` to avoid React/Next 16 streaming errors.
- Dropped `next-intl` and moved to Next.js App Router i18n pattern: custom locale config, dictionary loader, and client/server translation helpers.
- `apps/web/proxy.ts` now enforces locale prefixes, sets `NEXT_LOCALE` cookie, and injects `x-locale` header for server-side locale resolution.
- Awaited async `cookies()`/`headers()` usage for Next 16 and updated superadmin admin pages to await superadmin cookie headers; client-only pages now import locale `Link` from `navigation.client`.
- Simplified superadmin env to email/password only; removed session secret/API key and switched superadmin auth headers to use email/password.
- Added `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD` to Render env vars and Docker web build placeholders.
- Added header/footer language switcher that rewrites the locale prefix while preserving path and query.
- Added global category tree schema (categories + relations), seed data, and superadmin UI/actions to manage categories; added per-shop auction toggle (`canAuction`) in superadmin.
- Category tree API now guards malformed relations (ignores self-links, de-duplicates children, and falls back to all categories as roots if no roots are detected) so menus still render with imperfect data.
- Product/shop filter sidebars now show only root categories by default and reveal nested categories when a root is checked; selecting a root without sub-filters now matches all descendants.
- Header mobile UX updated: language switcher is hidden under `lg`, moved into the mobile side menu, mobile search moved to its own row, and the `iMall` wordmark is always visible.
- Home hero was replaced with the design-aligned variant and its static data moved into `components/marketing/hero-content.ts`.
- Public seller contact fields were added end-to-end (`sellerEmail`, `sellerPhone`, `sellerRules`): DB migration/schema, admin settings form/API, public shop profile API, and rendering on both shop and product pages when present.
- `dev:all` now rebuilds `@repo/db` first to keep generated exports in sync during local dev.
- Superadmin category tree now loads roots first and fetches child categories on expand via API routes.
- Added `seed:categories` script and Render build flag `SEED_CATEGORIES` for idempotent category seeding during API builds.
- Fixed Next 16 Cache Components bailout on `/[locale]/[slug]` by separating cached public fetchers from request-bound APIs (`auth()`, locale redirect helpers) in web server actions; `registerShop` now lazily imports locale redirect and cached shop/profile reads stay auth-free.
- Public shop profile server fetch now degrades to `null` on backend 5xx/network failures (instead of throwing) so Render/web startup does not spam `Failed to load shop profile`; favorites Next API proxies also avoid logging expected unauthorized guest/token-missing cases as errors.

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
