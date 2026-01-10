# Agents Notes

This file is a lightweight log for AI copilots. Keep entries terse and update when making changes future maintainers should know.

## Current context
- Monorepo root `.env` is the source of truth. `apps/web/next.config.js` force-loads it (prefers `@next/env`, falls back to `dotenv`) so Next dev/build picks up Clerk keys even when hoisted.
- Env validation lives in `packages/shared/src/env.ts` with an explicit `runtimeEnv` map and `isServer` flag so browser bundles receive the `NEXT_PUBLIC_*` values. Missing required keys crash early. Required: `DOMAIN`, `DATABASE_URL`, `NEXT_PUBLIC_DOMAIN`, `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; `CLERK_JWT_PUBLIC_KEY` is optional.
- After env code changes, rebuild shared: `cd packages/shared && bun run build` (usually handled by turborepo during dev/build).

## Recent changes
- Tightened Clerk env validation (server + client) and wired `ClerkProvider` to the validated env.
- Added monorepo-root env loading for the web app with a fallback to avoid `@next/env` missing-module errors when hoisted.
- Fixed browser-side env validation failures by feeding a curated `runtimeEnv` into `createEnv` and explicitly setting `isServer`.
- Typed product seed variants and guarded optional auctions in `scripts/seed.ts` so optional auctions stay lint-clean.
- Corrected `apps/api` dev/start scripts to run the source/built files directly with `bun --env-file`, which keeps `bun dev:api` from exiting immediately.
- Replaced `[shopSlug]/page.tsx` with a vendor profile layout powered by `ShopProfileClient` (tabs, stats, auction/products grid) and removed the unused `ShopProductsClient`.
- Wired TanStack React Query into the web app (provider in `app/layout.tsx`) with API helpers in `apps/web/lib/api` and mapping in `apps/web/lib/marketing.ts`; product/marketing pages now fetch on the client, using picsum-backed assets in `apps/web/assets`.
- Refreshed marketing surface (home/products/about/vendors/faq) so cards link to `/[shopSlug]/[productSlug]` (old `/p/` redirects) and vendor promos link to `/[shopSlug]`; seed data slugs align with those links.
- Added `/api/products` (randomized) so marketing/product grids can pull products across tenants without relying on env defaults; `/api/shops` exists for listing tenants. API product detail now attaches auctions per variant; CORS is handled via a manual preflight handler in `apps/api/src/index.ts`.

## Known gaps / follow-ups
- Ensure all environments set the required Clerk keys; browser fails fast otherwise.
- When adding new public env vars, extend `clientSchema` and the `runtimeEnv` map in `packages/shared/src/env.ts`.
- If Next is upgraded and `@next/env` behavior changes, re-check `apps/web/next.config.js` to keep root `.env` loading intact.
- Web grids/detail pages depend on the API at `NEXT_PUBLIC_DOMAIN`; run `bun run dev:all` and seed the DB to avoid connection errors in dev.
- Vendor names in marketing/shop cards currently use slug/env fallbacks until the API exposes tenant metadata.

## How to use this log
- Append bullets under “Recent changes” and “Known gaps / follow-ups” as you modify behavior.
- Capture rationale for non-obvious decisions (monorepo env loading, explicit runtime env mapping) so future agents know why it’s structured this way.
