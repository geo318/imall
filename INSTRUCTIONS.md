# Development Instructions & Best Practices

This document contains important instructions, dos and don'ts based on lessons learned during development.

## Authentication & Token Handling

### ✅ DO

- **Use token utilities for consistent handling**: Always use `extractTokenFromHeader()` and `verifyClerkToken()` from `apps/api/src/utils/token.ts` for token extraction and verification
- **Get token from client-side**: Use `getToken()` without parameters in client components - it uses Clerk's default session token
- **Handle malformed tokens**: Always check for tokens with more than 3 parts (duplicated tokens) and extract only the first 3 parts
- **Keep manual verification fallback**: In auction routes, keep the manual token verification fallback because `authPlugin` doesn't always run reliably
- **Use single Authorization header**: Only set `Authorization` header (not both `authorization` and `Authorization`)

### ❌ DON'T

- **Don't use template parameter**: Never call `getToken({ template: "default" })` - Clerk doesn't have a "default" template and will throw an error
- **Don't set duplicate headers**: Don't set both `authorization` and `Authorization` headers - this can cause header concatenation issues leading to malformed tokens
- **Don't assume authPlugin always runs**: The `authPlugin` in Elysia doesn't always populate the `auth` context, so always have a fallback for critical routes

## Auction Bidding

### ✅ DO

- **Use standard bid increments**: Use `calculateStandardIncrement()` and `calculateNextMinBid()` from `apps/web/lib/utils/bid-increments.ts` to avoid fractional steps
- **Auto-populate bid input**: Always initialize the bid input with the minimum bid amount on first mount
- **Use WebSocket for real-time updates**: Use `useAuctionWebSocket` hook instead of polling for real-time auction updates
- **Track winning state**: Use WebSocket messages to track if the current user is winning and update UI accordingly (green timer block)
- **Format bid amounts**: Always format bid amounts to 2 decimal places to avoid floating point display issues

### ❌ DON'T

- **Don't use fractional increments**: Avoid increments like $0.50 - use standard patterns ($1, $5, $10, $25, $50, $100 based on price range)
- **Don't poll when WebSocket is available**: WebSocket provides real-time updates, polling is unnecessary and causes performance issues
- **Don't update state unnecessarily**: Use refs to track previous values and only update state when values actually change

## State Management & Performance

### ✅ DO

- **Use refs for tracking**: Use `useRef` to track previous values and prevent unnecessary state updates
- **Memoize callbacks**: Use `useCallback` for callbacks passed to hooks to prevent infinite loops
- **Separate initialization from updates**: Use separate `useEffect` hooks for initialization vs. updates
- **Use React.memo**: Wrap expensive components like timers with `React.memo` to prevent unnecessary rerenders
- **Optimize timer updates**: Only update timer state when the displayed value actually changes, not every second

### ❌ DON'T

- **Don't include setState in dependencies**: Don't include `setState` functions in `useEffect` or `useCallback` dependency arrays - they're stable
- **Don't update on every render**: Check if values actually changed before updating state
- **Don't create new objects in render**: Avoid creating new objects/arrays in render that will cause unnecessary rerenders

## Logging

### ✅ DO

- **Use logger utility**: Use `logger` from `apps/api/src/utils/logger.ts` for environment-aware logging
- **Log errors in development**: Use `logger.error()` for errors, `logger.debug()` for development-only logs
- **Keep essential error logs**: Keep error logging for debugging production issues

### ❌ DON'T

- **Don't use console.log in production**: Remove or replace with `logger.debug()` which only logs in development
- **Don't log sensitive data**: Never log full tokens, passwords, or other sensitive information
- **Don't log excessively**: Remove redundant logs that don't add value

## Code Organization

### ✅ DO

- **Create reusable utilities**: Extract common logic into utility functions (e.g., token handling, bid increments)
- **Use TypeScript types**: Always type function parameters and return values
- **Keep functions focused**: Each function should do one thing well
- **Use consistent naming**: Follow existing naming conventions in the codebase

### ❌ DON'T

- **Don't duplicate code**: If you find yourself copying code, extract it into a utility
- **Don't mix concerns**: Keep authentication, business logic, and UI separate
- **Don't ignore linter warnings**: Fix linter warnings, especially type errors

## WebSocket Implementation

### ✅ DO

- **Use refs for stable callbacks**: Store callbacks in refs to avoid dependency issues in WebSocket hooks
- **Handle reconnection**: Implement exponential backoff for WebSocket reconnection
- **Invalidate cache on updates**: Use React Query's `invalidateQueries` when WebSocket messages indicate data changes
- **Include bidder info**: Always include `bidderId` (externalAuthId) in WebSocket bid messages so frontend can determine if user is winning

### ❌ DON'T

- **Don't create new WebSocket on every render**: Use `useEffect` with proper dependencies to manage WebSocket lifecycle
- **Don't forget cleanup**: Always close WebSocket connections in cleanup functions
- **Don't ignore connection errors**: Handle WebSocket errors gracefully with user feedback

## Next.js & React

### ✅ DO

- **Use Suspense boundaries**: Wrap async components in Suspense to prevent blocking
- **Use server actions**: Prefer server actions over API routes for data mutations
- **Handle loading states**: Always show loading skeletons or states while data is fetching
- **Optimize images**: Use Next.js Image component with proper sizing

### ❌ DON'T

- **Don't use force-dynamic unnecessarily**: Only use `export const dynamic = "force-dynamic"` when absolutely necessary
- **Don't access uncached data in render**: Use Suspense or client components for dynamic data
- **Don't block navigation**: Don't use blocking operations in layout or page components

## Environment Variables

### ✅ DO

- **Validate env vars**: Always validate environment variables using the shared env schema
- **Use NEXT*PUBLIC* prefix**: Use `NEXT_PUBLIC_` prefix for client-accessible environment variables
- **Document required vars**: Document all required environment variables in README or env.example

### ❌ DON'T

- **Don't access server env in client**: Never access server-only env vars in client components
- **Don't hardcode values**: Use environment variables instead of hardcoding URLs, keys, etc.

## Testing & Debugging

### ✅ DO

- **Test authentication flows**: Always test authentication flows, especially token handling
- **Test edge cases**: Test malformed tokens, missing headers, etc.
- **Use development logs**: Enable detailed logging in development to debug issues
- **Test WebSocket connections**: Verify WebSocket connections work in both development and production

### ❌ DON'T

- **Don't ignore authentication errors**: Always handle 401/403 errors gracefully
- **Don't assume everything works**: Test critical paths like bidding, authentication, etc.
- **Don't leave debug code**: Remove console.logs and debug code before committing

## Common Issues & Solutions

### Issue: Token has 5 parts instead of 3

**Solution**: This happens when headers are concatenated. Use `extractTokenFromHeader()` which extracts the first 3 parts.

### Issue: authPlugin doesn't populate auth context

**Solution**: Keep manual token verification fallback in critical routes like auction bids.

### Issue: Infinite useEffect loops

**Solution**: Use refs to track previous values, memoize callbacks, and only include stable dependencies.

### Issue: Bid input is empty on first load

**Solution**: Use separate `useEffect` for initialization with `initializedRef` to track first mount.

### Issue: Timer rerenders too frequently

**Solution**: Only update state when displayed value changes, use `React.memo`, and optimize update intervals.

## File Structure

```
apps/
  api/
    src/
      utils/          # Shared utilities (token, logger)
      routes/         # API route handlers
      context.ts      # Shared context (authPlugin, etc.)
  web/
    app/
      actions/        # Server actions
      [slug]/         # Dynamic product/shop routes
    lib/
      utils/          # Client utilities (bid-increments, etc.)
      hooks/          # Custom React hooks
```

## Quick Reference

### Token Extraction

```typescript
import { extractTokenFromHeader, verifyClerkToken } from "../utils/token";

const token = extractTokenFromHeader(authHeader);
if (token) {
  const verified = await verifyClerkToken(token);
}
```

### Client Token

```typescript
const { getToken } = useAuth();
const token = await getToken(); // No template parameter!
```

### Standard Bid Increments

```typescript
import { calculateNextMinBid } from "@/lib/utils/bid-increments";

const minBid = calculateNextMinBid(currentPrice, minIncrement);
```

### WebSocket Hook

```typescript
useAuctionWebSocket({
  shopSlug,
  auctionId: auction.id,
  enabled: isAuctionActive,
  onMessage: handleWebSocketMessage,
});
```

## Notes

- The monorepo uses TurboRepo for build orchestration
- Backend uses Elysia.js framework
- Frontend uses Next.js 16 with App Router
- Authentication uses Clerk
- Database uses Drizzle ORM with PostgreSQL
- State management uses TanStack Query (React Query)
