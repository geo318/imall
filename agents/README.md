# AI Agent Notes (workspace)

Purpose: quick orientation for future agents working on this monorepo.

## What changed recently
- Web app now uses TanStack React Query (provider in `apps/web/app/layout.tsx`) and API helpers in `apps/web/lib/api/` with marketing mapping in `apps/web/lib/marketing.ts`. Shop/product pages fetch on the client instead of server-blocking.
- Marketing surface refreshed (home/products/about/vendors/faq) with picsum assets, shared logo in `apps/web/assets`, and mocks in `apps/web/MOCKS` only for placeholder text.
- Seed script (`scripts/seed.ts`) populates `demo-shop` with the slugs linked from the marketing/product cards; API `/api/shops/:shopSlug/products` returns variants for price display.

## Ops and env
- Root `.env` is the source of truth; `apps/web/next.config.js` force-loads it so Clerk/API keys reach Next. Required keys are documented in `packages/shared/src/env.ts`.
- Run API + web together (`bun run dev:all`) with `NEXT_PUBLIC_DOMAIN` pointing at the API (default `http://localhost:3001`). If the API is down, React Query components show failure states instead of silent mocks.
- After DB startup, run `bun run seed` to keep products in sync with the marketing links.

## Pointers
- Data fetching: `apps/web/lib/api/products.ts`, marketing mapper in `apps/web/lib/marketing.ts`, React Query provider in `apps/web/app/query-provider.tsx`.
- Marketing UI components: `apps/web/components/marketing/*`; pages live under `apps/web/app` (home/products/about/vendors/faq).
- Env validation: `packages/shared/src/env.ts`; monorepo env loader: `apps/web/next.config.js`.

## Gaps to mind
- Shop names on marketing/shop listings currently fall back to the slug/env; wire real tenant metadata once the API exposes it.
- API must be running for product grids/detail pages; consider adding a lightweight status check if failures persist.
