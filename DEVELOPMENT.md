# Local Development

1. Install deps: `bun install`
2. Configure env: copy `.env.example` to `.env` and adjust values (DATABASE_URL, DOMAIN, NEXT_PUBLIC_DOMAIN, optional Clerk keys).
3. Generate/apply migrations: `bun run db:generate` then `bun run db:push` (requires Postgres running and DATABASE_URL set).
4. Seed demo data: `bun run seed` (creates demo tenant/product/variant/auction).
5. Start dev servers:
   - API: `bun run dev:api` (port 3001)
   - Web: `bun run dev:web` (port 3000)
   - Or both: `bun run dev:all`
6. Tests: `bun test`
7. Lint/format: `bun run lint:biome` / `bun run format:biome`
