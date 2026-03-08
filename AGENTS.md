# Agents Notes

This file is a lightweight log for AI copilots. Keep entries terse and update when making changes future maintainers should know.

## Current context

- Monorepo root `.env` is the source of truth. `apps/web/next.config.js` force-loads it (prefers `@next/env`, falls back to `dotenv`) so Next dev/build picks up Clerk keys even when hoisted.
- Env validation lives in `packages/shared/src/env.ts` with an explicit `runtimeEnv` map and `isServer` flag so browser bundles receive the `NEXT_PUBLIC_*` values. Missing required keys crash early. Required: `DOMAIN`, `DATABASE_URL`, `NEXT_PUBLIC_DOMAIN`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; `CLERK_JWT_PUBLIC_KEY` is optional.
- After env code changes, rebuild shared: `cd packages/shared && bun run build` (usually handled by turborepo during dev/build).

## Recent changes

- Refactored checkout into smaller maintainable pieces: route files are now server wrappers, shared client flow moved to `apps/web/components/checkout/*` (`use-checkout-controller`, `shipping-step`, `payment-step`, `order-summary`, confirmation/banner/progress), and both checkout routes reuse one implementation with route-specific cart key + continue URL.
- Added persistent user shipping-address book support: new DB table (`user_shipping_addresses`), authenticated API routes (`/api/users/me/addresses` CRUD), checkout saved-address cards with auto-save of the first filled shipping address, a new account page (`/[locale]/account/addresses`) for managing multiple addresses, and header dropdown links to that page.
- Added Credo installments integration in cart checkout: new API endpoints `/api/carts/:cartId/checkout/installments/start` and `/api/carts/:cartId/checkout/installments/status`, cart-bound signed order codes (no DB state required), Credo status sync + auto local checkout when status reaches `DOCUMENT_ASSIGNED`/`CLOSED_SUCCESSFULLY`, and web checkout pages now support redirect + pending status checks.
- Added `scripts/cleanup-image-storage.ts` plus root scripts `images:cleanup` / `images:cleanup:apply` to clean stale Cloudinary URLs (`products.image_urls`, `variant_option_values.thumbnail_url`) and prune orphan Cloudinary blobs (`assets.storage_key` without DB/URL references, age-gated by `--min-age-hours`, default 24h).
- Added production-grade Cloudinary image storage path: new `CloudinaryStorage` implementation (`apps/api/src/storage/cloudinary-storage.ts`) with signed upload/delete, delivery URL generation, and legacy local-key URL fallback; storage factory now resolves provider via `IMAGE_STORAGE_PROVIDER` (or Cloudinary env presence) and supports switching off local disk persistence. Cloudinary credentials are now `CLOUDINARY_URL`-first (`cloudinary://<api_key>:<api_secret>@<cloud_name>`) with segmented env fallback for compatibility.
- Centralized image URL normalization was moved to `@repo/shared/images` (`normalizeImageUrl`, `parseImageUrls`, `normalizeImagePathSegment`) and both API (`products/admin-products/carts`) plus web (`/api/image` proxy + `lib/utils/images`) now use the shared implementation.
- Image serving fallback was expanded for legacy bad keys: when direct `/api/image/{shopSlug}/...` lookup misses, API now also tries filename-based fallback inside `/{shopSlug}` and one nested folder level (`/{shopSlug}/{productId}`), which recovers cases where URLs have wrong/missing middle segment.
- Added image URL normalization at API read/write boundaries: product/admin/cart routes now sanitize malformed suffixes like `.webp-0-0` before returning/saving URLs, and web `/api/image` proxy retries with normalized filename on 404 to reduce broken legacy image links.
- Production image 404 hardening: upload dir resolution now supports ordered candidates (`/var/data/uploads` first when mounted, legacy `apps/api/src/uploads` fallback), image serving checks all candidates before 404, startup diagnostics log upload-dir candidates/existence, and `render.yaml` now declares a persistent API disk mount at `/var/data` to avoid losing images across restarts/deploys.
- Image URL corruption guard expanded: malformed image suffixes like `.webp-0-0` are now normalized on web URL rendering and also tolerated on API image reads by trying a normalized filename fallback (`.webp`) before returning 404.
- Home "Why iMall" block was refined for a cleaner look and simpler tone: removed forced uppercase eyebrow styling, tightened typography/cards/list styling, and rewrote Georgian (`ka`) copy to concise messaging for `home.why`, `home.valueProps`, and `home.forVendors`.
- Product price filter slider now uses a local draft range and commits to parent state only on `onValueCommit` (thumb release), preventing rapid API refetch spam while dragging; slider labels now use GEL symbol (`₾`) instead of `$`.
- Featured products section is now fully i18n-driven (title/subtitle/loading/error/empty in EN/KA/RU), and marketing auction timer text is localized (`endsIn`/`endsSoon`) so locale pages no longer show English copy in cards.
- GEL symbol rollout completed on checkout/cart/admin money displays: shared web formatter now normalizes all display currency to `GEL` (`₾`) for legacy/non-GEL records, checkout/cart totals use formatter end-to-end, and product/admin price labels now show symbol-based currency markers (no raw `USD` codes).
- Superadmin cross-tenant admin access was hardened: Next admin product list/create and admin image-upload API routes now use shared `backendRequest` (which injects superadmin headers when `superadmin_session` exists), and backend inventory routes now accept superadmin via `adminOrSuperadminGuard` instead of `adminGuard`.
- Vendor spotlight on homepage is now dynamic: replaced static `homeVendorsMock` cards with cached backend-driven shops data (`/api/shops/spotlight`) including per-tenant product/sales aggregates and top product category, with graceful fallback to live shop list if spotlight stats are unavailable.
- Footer locale switcher was moved into the brand block (replacing footer social icon links), and the duplicate switcher in the bottom legal row was removed.
- Hero mobile viewport tuning: hero section now uses `min-h-[100dvh]` on mobile and hero canvas is locked to `100dvh` on mobile (`top: 0`), while desktop keeps the extended canvas sizing (`md:-top-[100px]`, `md:h-[calc(115dvh+100px)]`).
- Localized EN/KA/RU copy on remaining commerce/admin surfaces: cart pages, both checkout routes, product detail helper slots (availability/actions/share/status/not-found/similar products), and admin dashboard/orders/payouts/returns/shipping/customers/catalog shell + variant options + product list.
- Admin dashboard now enforces seller gating in UI via `/api/admin/:shopSlug/settings` (`canSell`): non-seller shops only see Settings plus a pending-approval notice; seller-only cards/overview widgets stay hidden.
- Checkout pricing logic changed: removed tax line from checkout pages and added conditional installment commission (`12%` of subtotal) applied only when `installments` payment method is selected; default card/paypal totals remain subtotal + shipping with no extra charge.
- Switched product-related default currency from USD to GEL and added currency-symbol rendering (`₾`) on major product UI surfaces (marketing cards, product price slot/detail variant labels, admin catalog list, header favorites); new product variant defaults now initialize as GEL in both web form schema/state and API admin product route fallbacks.
- Fixed create-product visibility lag: admin product writes now actively invalidate API in-memory public product caches (`products:any`, `products:search`, `products:shop:*`), Next proxy routes for public product feeds (`/api/products`, `/api/products/search`, `/api/shops/[shopSlug]/products`) keep `revalidate: 30` caching but now attach explicit cache tags (`products`, `shop-${shopSlug}`) so admin create/update/delete revalidation clears them immediately; admin form success also invalidates client query keys for public feeds (`products`, `shop-products`).
- Fixed admin product image persistence bug: editing products no longer rewrites existing image URLs into invalid `...file.webp-<index>` strings (`product-form.tsx` now keeps real URLs for existing images and submits them unchanged); image URL helper also normalizes legacy corrupted suffixes for recovery on existing records.
- API uploads now auto-resolve to Render persistent disk path (`/var/data/uploads`) when available, otherwise fallback to local `apps/api/src/uploads`; both writer (`LocalStorage`) and reader (`/api/image/*`) use the same resolver and startup diagnostics log the resolved uploads path.
- Added a web passthrough image route at `apps/web/app/api/image/[...path]/route.ts` that proxies `/api/image/*` to the API service via `BACKEND_URL`; this fixes production image loading when product image URLs are relative and the web app runs on a separate domain/service.
- Variant option pairs now support optional thumbnails end-to-end: added `variant_option_values.thumbnail_url` (schema + migration), admin create/update/read now persists and returns `optionThumbnail`, tenant option value suggestions include thumbnail metadata, and admin/catalog + storefront product detail UI render/use optional value thumbnails.
- API startup now binds with `reusePort: false` (`apps/api/src/index.ts`) so duplicate/stale `apps/api` dev processes cannot silently share port `3001` and serve inconsistent route tables.
- Fixed server-side admin data fetch auth forwarding: admin pages now send the full incoming cookie header (`getServerAuthCookieHeader`) instead of only `superadmin_session`, so Clerk-authenticated admins no longer hit 401/500 on SSR fetches like `/admin/[slug]/settings`.
- Added dedicated Next API proxy routes for tenant variant options (`/api/admin/[shopSlug]/variant-options` and `/api/admin/[shopSlug]/variant-options/[optionId]`) so option CRUD does not depend on generic catch-all proxy matching.
- Added a separate tenant-level Variant Options admin view (`/admin/[slug]/catalog/options`) backed by admin shop API endpoints (`/api/admin/:shopSlug/variant-options`) for create/rename/delete/list of reusable option names; product variant editor now selects from this tenant option library (with optional custom override) and shows known per-option value suggestions.
- Added Shopify-style variant option modeling end-to-end: new DB tables (`tenant_variant_options`, `product_option_definitions`, `variant_option_values`), admin create/update wiring to upsert tenant option names and persist per-variant option pairs, and product/admin read APIs now return `optionDefinitions` + variant `optionPairs` for storefront rendering.
- Fixed optional variant SKU validation in admin catalog: form schema now treats `null`/empty SKU as optional (`undefined`), edit-form reset normalizes API `sku: null`, and save payload trims SKU and sends `undefined` when blank.
- Admin product form validation UX improved: nested variant field errors are now surfaced inline in `VariantForm` (price/stock/auction fields), root variant errors render under the variants section, and toast aggregation now recursively collects nested React Hook Form/Zod messages instead of falling back to generic "check form errors".
- Markdown renderer now uses `remark-gfm` (GitHub Flavored Markdown) through shared `MarkdownContent`, with GitHub-like prose styling and stronger normalization for malformed AI markdown (`markdown` prefixes, hidden spaces/chars, collapsed headings, broken image/link spacing).
- Admin product save path now normalizes markdown before persisting (`normalizeMarkdownInput`), reducing malformed one-line/hidden-character markdown in stored product descriptions.
- Markdown rendering now normalizes messy AI-generated product descriptions before render (strips hidden chars, removes `markdown` wrappers/fences, decodes escaped `\\n`, and restores collapsed headings/lists/dividers), improving both admin preview and storefront product description output.
- Product descriptions now render as Markdown on public product detail pages via shared `MarkdownContent` (`react-markdown`) instead of plain `whitespace-pre-wrap` text, so seller-authored markdown from admin is displayed correctly.
- Admin catalog `MarkdownEditor` preview now uses the same shared renderer as product detail to keep markdown output consistent between admin preview and storefront display.
- Hero copy intro now uses a single composited `hero-copy-reveal` animation (replacing per-element stagger classes) to eliminate flicker/jank on initial text/button paint; reduced-motion path disables it.
- Header auth hydration is now server-seeded via `getInitialHeaderAuth()` (`"use cache: private"`) in a dedicated server component (`HeaderServer`) streamed behind `Suspense`; fallback/header greeting uses fixed-width animated skeletons (`animate-ping`) to avoid `Hello, {username}` layout shifts.
- Added explicit hero rerender-guard tests: `hero-background.test.js` now asserts `resolveIconNodesState` keeps the previous reference when node geometry is unchanged (and switches reference only when changed), which validates the no-rerender path after initial load.
- Murmuration pacing was increased by ~10-20% (higher `timeStep` and speed limits across device tiers) while retaining adaptive low-end/reduced-motion profiles.
- Mobile/low-end performance + a11y pass: hero murmuration now adapts quality by device capability (`particleCount`, `iconParticleCount`, FPS throttle), tracks mouse only on fine pointers, caps DPR, and pauses offscreen/hidden; hero icon visuals were lightened on mobile and canvas pointer events disabled to avoid touch interception; header controls gained accessible labels/ARIA (`menu`, `categories`, search clear, cart), and homepage below-the-fold sections now use `content-visibility` via `render-budget-section`.
- Page-speed and stability pass for hero: `useMurmuration` now caps DPR (`1.5`), throttles draw loop to ~45 FPS, and pauses animation when tab is hidden or hero canvas is off-screen (IntersectionObserver + visibility handling); `HeroBackground` now guards icon-node state updates with layout-change + node-equality checks to avoid unnecessary rerenders.
- Added hero stability tests (`apps/web/components/marketing/hero-background.test.js`) covering deterministic icon-node layout generation, layout-change thresholds, and equality checks used to prevent rerender churn after initial load.
- Improved hero icon load timing: `HeroBackground` now pre-renders fallback icon-node positions and switches to `useLayoutEffect` for immediate measured positioning before paint, reducing the perceived delayed icon appearance on initial load.
- Dev-mode murmuration reset mitigation: added short-lived snapshot reuse across rapid unmount/remount cycles (particle state, time, mouse), which smooths React Strict Mode double-mount in development and prevents visible restart/jump on load.
- Fixed hero murmuration startup reset/jump: removed post-start particle reseeding when icon nodes initialize, and moved optional icon-cluster seeding to initial particle creation only (when nodes are already available), so animation no longer restarts mid-load.
- Hero murmuration reveal now starts from the bottom-left corner and expands upward/outward via `clip-path` (with opacity ramp), replacing the full-screen pop-in fade; includes a non-`clip-path` fallback and reduced-motion bypass.
- Added a dedicated hero murmuration reveal animation (`hero-canvas-reveal`) so the canvas fades in on load instead of popping abruptly; reduced-motion users get immediate static opacity.
- Murmuration motion was slowed slightly for smoother pacing: reduced global time step, lowered mouse repulsion strength, and reduced particle speed cap.
- Language switcher now has an animated sliding selection pill that transitions between locales; selection updates optimistically on click and finalizes when the locale route updates (still using client-side `router.replace` without full refresh).
- Added Zoommer-style Georgian typography: bundled Firago font files (`Regular/Medium/SemiBold`) in `apps/web/public/fonts`, wired a `--font-firago` local font in locale layout, and switch body font to `font-firago` when `locale === "ka"` (other locales keep Geist sans).
- Language switcher now uses client-side `router.replace(..., { scroll: false })` transitions instead of locale anchor links, so locale changes happen without full page refresh.
- Hero canvas murmuration now includes a small icon-particle layer (emoji glyph particles, shop-spark style) mixed with dots, preserving the coordinated icon-anchor flock logic.
- Hero pass: adopted `shop-spark` murmuration anchor tactics (icon-node halos, per-particle icon target switching/orbit, and anchor-link strokes) while preserving the denser coordinated flocking baseline; hero canvas now renders at `calc(115dvh + 100px)`, hero glass blurs were reduced, Georgian trust-pill copy was shortened, and header search inputs now use emerald-tinted borders/focus rings.
- Hero murmuration now preserves icon-node coordination: particles are lightly reseeded near shop icons on first frame and apply icon-local pull+swirl forces each frame, restoring dense groups around floating icon anchors without restarting the canvas effect on icon state updates.
- Header glass shell no longer renders a bottom border and now uses a lighter 4px backdrop blur; hero murmuration was reset to the `origin/main` coordination pattern (256-particle dual-attractor flocking) while keeping the current hook signature used by `HeroBackground`.
- Hero background canvas now extends 100px upward (`-top-[100px]`, height compensation) and edge icon offsets were adjusted per design tuning: top icon +50px lower and bottom icon 20px lower.
- Hero-to-content handoff was softened with a two-layer gradient seam: a taller in-hero bottom fade plus a small transition strip before featured products, reducing the hard edge between sections.
- Borrowed the `shop-spark` icon transition pattern: `hero-icon-drift-*` keyframes now use the same multi-step drift path (0/25/50/75/100) for smoother hero background motion.
- Hero is now pulled under the header for overlay behavior (`-mt/pt` offsets), hero section height increased ~20% with a bottom gradient handoff, top/bottom floating icons are anchored at exact ±20px edges, and murmuration retuned for faster/denser coordinated motion with capped DPR + throttled frame pacing.
- Hero murmuration was retuned for smoother coordinated motion with lower render cost: capped canvas DPR (`1.5`), frame throttling, squared-distance link checks, and tuned flock forces/speed; top and bottom floating icons are pinned with fixed 20px edge offsets.
- Guest `Sign in` header buttons (desktop + mobile drawer) now use the same emerald rounded style as hero CTAs for visual consistency.
- Hero visual parity pass: floating shop icons now use emerald circular badges/halos and CTA buttons were restyled to green rounded variants (primary filled + secondary outline) to match the source hero treatment.
- Hero was tuned for stricter shop-spark parity and fold fit: shorter vertical footprint (`min-h` + tighter `py`), compact typography for KA/RU locales, icon-node markup/classes aligned to source, and murmuration forces rebalanced for more coordinated flocking.
- Hero section now mirrors `shop-spark`'s upgraded design/behavior: animated icon nodes + richer murmuration interactions (node attraction, icon particles, glow halos), refreshed CTA layout, and localized trust-pill copy wired through `home.hero.pills` in EN/KA/RU.
- Hero flicker mitigation now keeps background/content on separate layers, with hero text rendered on the composited `hero-content-layer` while canvas interactivity stays isolated in `hero-background.tsx`.
- Hero rendering remains split server/client: `HeroSection` stays server-rendered for translations while `hero-background.tsx` owns all canvas + floating icon interactivity (canvas keeps `pointerEvents: auto` for mouse repulsion).
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
- Auction closer background worker now detects missing `auctions` table (`42P01`) and disables itself after a single warning instead of logging the same error every 30s when DB migrations are missing/out-of-sync.
- API startup diagnostics now log a redacted env/DB summary and DB probe (`current_database`, schema, `to_regclass('public.auctions')`) before listening; `Dockerfile.api` now starts via `scripts/api-entrypoint.mjs`, which logs step-by-step startup and explicit `db:push` migration success/failure before launching the API process.
- Web Docker runtime now starts via `scripts/web-entrypoint.mjs` to log startup env/backend wiring and optional memory heartbeats (`WEB_MEMORY_LOG_INTERVAL_MS`); `render.yaml` web `BACKEND_URL` service reference was corrected to `imall-api`.
- `drizzle.config.ts` now reads `DATABASE_URL` directly from `process.env` instead of importing the shared app env validator, so `drizzle-kit push/generate` can run in Render/API startup without requiring unrelated app vars (Clerk, `DOMAIN`, `SUPERADMIN_*`).
- API startup migrations now use non-interactive `db:push:ci` (`drizzle-kit push --force`) in `scripts/api-entrypoint.mjs`; API boot DB probe checks `products`/`tenants` tables and exits startup if core schema is missing (prevents serving a broken API after a migration prompt/abort).
- Admin server pages (`orders`, `settings`, `payouts`, `shipping`, `returns`, `customers`) no longer build local admin API URLs from `NEXT_PUBLIC_DOMAIN` (which was baked as Docker build placeholders); they now derive request origin from runtime headers via `apps/web/lib/server/request-origin.ts`.
- Superadmin category UI now includes a one-time "Seed initial categories" button; backend route `/superadmin/categories/seed-initial` runs `scripts/seed-categories.ts` in-process via Bun and skips if any category already exists.
- Added `agents/SKILL.md` as a structured, repo-specific AI-agent playbook distilled from existing project docs (`AGENTS.md`, `DEVELOPMENT.md`, `IMPLEMENTATION.md`, `INSTRUCTIONS.md`), with startup commands, Next.js/Bun/Elysia guardrails, and failure playbooks.
- Expanded both `agents/SKILL.md` and root `SKILL.md` with a detailed Next.js 16 Cache Components section (`"use cache"` modes, request-bound API boundaries, invalidation patterns with `cacheTag`/`updateTag`/`revalidateTag`, and migration heuristics).
- Performance pass: replaced expensive product `ORDER BY random()` DB sorts with deterministic windowed shuffling, added backend category filtering for product searches (public + shop), batched inventory availability reads (`getAvailableStockMap`) to remove N+1 stock checks in product/cart paths, collapsed product-stats writes into cached-tenant upserts, added cache-control headers for public catalog/shop/category APIs, tuned React Query stale/refetch behavior on high-traffic pages, and added hot-path DB indexes in `packages/db/src/schema.ts` (users auth lookup, memberships, products, variants, cart items, inventory ledger, auctions, bids, etc.).
- Follow-up performance pass: removed global product `COUNT(*)` scans from random product feed path, added O(1) auction lookup maps in product detail serializers, capped infinite-query page retention (`maxPages`) to reduce browser memory growth, switched hot Next API proxies (`categories/tree`, shop products, product detail) to response streaming passthrough to avoid extra JSON parse/stringify overhead, and made DB pool sizing/timeouts configurable via env (`DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS`) with conservative defaults.
- Ultra-lean pass: added in-process API response cache + in-flight dedupe (`apps/api/src/utils/response-cache.ts`) and applied it to public category/shop/product list/search routes; moved non-critical product stats writes to a batched async queue (`apps/api/src/utils/product-stats-queue.ts`) with periodic flush; auction closer now uses Postgres advisory locking to ensure only one instance runs close-expired work at a time across scaled API replicas; web product client API switched from server actions to lightweight service calls (with optional direct backend via `NEXT_PUBLIC_BACKEND_URL`) and added `/api/products` + `/api/products/search` proxy handlers.

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
