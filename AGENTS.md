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

## Known gaps / follow-ups
- Ensure all environments set the required Clerk keys; browser fails fast otherwise.
- When adding new public env vars, extend `clientSchema` and the `runtimeEnv` map in `packages/shared/src/env.ts`.
- If Next is upgraded and `@next/env` behavior changes, re-check `apps/web/next.config.js` to keep root `.env` loading intact.

## How to use this log
- Append bullets under “Recent changes” and “Known gaps / follow-ups” as you modify behavior.
- Capture rationale for non-obvious decisions (monorepo env loading, explicit runtime env mapping) so future agents know why it’s structured this way.
