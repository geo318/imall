---
name: emakret-repo-skill
description: Repo-specific development playbook for iMall (Next.js 16 + Bun + Elysia + Drizzle + Render).
---

# iMall Repository Skill

Use this skill as the default orientation for AI agents working in this repository.

## Purpose

- Provide one consistent, structured source of truth for day-to-day development.
- Reduce repeated debugging for common failures (env, migrations, cache boundaries, Render deploys).
- Keep changes aligned with current architecture and repo conventions.

## Stack and Shape

- Monorepo: Turborepo + Bun workspaces
- Web: `apps/web` (Next.js 16 App Router)
- API: `apps/api` (Elysia + Drizzle)
- DB package: `packages/db` (schema + Drizzle migrations)
- Shared env/types: `packages/shared`
- Shared UI: `packages/ui`
- Deploy target: Render (`Dockerfile.api`, `Dockerfile.web`, `render.yaml`)

## Canonical Docs in This Repo

- Agent log and current operational state: `AGENTS.md`
- Engineering constraints and dos/don'ts: `INSTRUCTIONS.md`
- Local setup workflow: `DEVELOPMENT.md`
- Architecture and implementation roadmap: `IMPLEMENTATION.md`
- Root command map: `package.json`

## Fast Start

1. Install dependencies: `bun install`
2. Ensure root `.env` exists and required keys are set.
3. Start DB and push schema: `bun run db:docker && bun run db:push`
4. Seed baseline data: `bun run seed`
5. Run both services: `bun run dev:all`

## High-Value Commands

- Web dev only: `bun run dev:web`
- API dev only: `bun run dev:api`
- Typecheck web: `bunx tsc --noEmit -p apps/web/tsconfig.json`
- Typecheck api: `bunx tsc --noEmit -p apps/api/tsconfig.json`
- Generate migration: `bun run db:generate`
- Push migration: `bun run db:push`
- CI/startup push (non-interactive): `bun run db:push:ci`
- Seed categories: `bun run seed:categories`

## Env and Runtime Rules

- Root `.env` is the source of truth.
- `apps/web/next.config.js` force-loads root env for Next build/dev.
- Env validation is centralized in `packages/shared/src/env.ts`.
- `drizzle.config.ts` intentionally reads `DATABASE_URL` directly (do not re-couple it to app-wide env validation).
- For server-side internal web fetches, do not hardcode `NEXT_PUBLIC_DOMAIN`; resolve runtime origin from request headers.

## Next.js 16 Cache Components Rules (Critical)

- Cache Components are explicit opt-in caching; dynamic execution is the default behavior.
- `cacheComponents: true` is required in `next.config.*` for `"use cache"` directives.
- Cache Components absorb the old experimental PPR flag model (`experimental.ppr` removed).
- Never call request APIs (`headers()`, `cookies()`, `searchParams`) inside `"use cache"` scope.
- Preferred pattern for runtime data: read request APIs outside cached scopes and pass values as function arguments.
- Keep cached readers isolated from auth/request-bound helpers to avoid `NEXT_STATIC_GEN_BAILOUT`.
- Route handlers: use `"use cache"` in extracted helpers, not directly as route-handler body logic.

### Cache mode selection

- `use cache`: default shared cache mode for static-ish reusable data.
- `use cache: remote`: shared across instances through configured remote handler; adds lookup latency and infrastructure cost.
- `use cache: private`: allows request APIs inside cached scope, but is experimental, browser-memory scoped, and not recommended for production-first paths.

### Invalidation and freshness

- Tag cached data with `cacheTag(...)`.
- For read-your-writes UX (forms/settings): use `updateTag(tag)` in Server Actions.
- For SWR-style invalidation: use `revalidateTag(tag, profile)` (second argument is required in v16).
- `refresh()` is for refreshing uncached data in Server Actions; it does not mutate cache entries.

### Runtime behavior notes

- Default `use cache` profile: `stale` 5m (client), `revalidate` 15m (server), `expire` none.
- Client router enforces a minimum ~30s stale window.
- `React.cache` values do not cross into `"use cache"` scope (isolation boundary).

### Repo-specific guardrails

- Keep `apps/web/proxy.ts` patterns; avoid reintroducing deprecated middleware approach.
- If you hit `Cannot access cookies()/headers() in "use cache"`, immediately split runtime access from cached function.
- When a page needs personalization and cannot be refactored cleanly, evaluate whether private cache tradeoffs are acceptable before using `'use cache: private'`.

## Auth Rules (Critical)

- Use Clerk token utilities in API: `extractTokenFromHeader`, `verifyClerkToken`.
- Keep manual verification fallback where documented (auction routes).
- Do not set both `authorization` and `Authorization` headers.
- In client, use `getToken()` without template overrides.

## DB and Migration Rules (Critical)

- `42P01` (`relation does not exist`) almost always means wrong DB or schema not applied.
- API container startup runs migrations; keep it non-interactive.
- API startup probe must confirm core tables exist before serving traffic.
- If tables are missing after a reported migration success, verify `DATABASE_URL` target first.

## Render Deployment Rules

- API and web are Docker-based from `render.yaml`.
- Web `BACKEND_URL` must reference the API service by correct name (`imall-api`).
- If Blueprint sync fails on schema fields, apply compatible `render.yaml` format for the workspace.
- Use entrypoint logs (`scripts/api-entrypoint.mjs`, `scripts/web-entrypoint.mjs`) for startup diagnostics.

## Superadmin and Category Management

- Superadmin UI includes one-time initial category seed action.
- Backend route: `POST /superadmin/categories/seed-initial`
- Seed is guarded: if categories already exist, action is no-op.

## Common Failure Playbooks

### 1) `headers() inside "use cache"` / `NEXT_STATIC_GEN_BAILOUT`

- Inspect cached server actions/components for request API usage.
- Split cached/public readers from auth/request-bound code.

### 2) `relation "<table>" does not exist`

- Confirm migration step actually executed non-interactively.
- Confirm DB probe table presence.
- Confirm API and migration target the same `DATABASE_URL`.

### 3) Web points to `placeholder.example.com`

- Replace build-time domain usage in server page fetches with runtime request-origin resolution.

### 4) Repeated log spam every 30s

- Check background workers/interval jobs.
- Guard worker startup or disable after known schema-missing error classes.

## Editing and Review Expectations

- Prefer small, focused commits by concern.
- Keep generated migration artifacts grouped and reviewed separately.
- Do not revert unrelated dirty worktree changes.
- Validate with targeted typecheck/tests before commit.

## When Updating This Skill

- Update when architecture, deploy flow, or critical operational rules change.
- Keep this file concise; add details to source docs and link back here.
