# Clerk Backend Authentication

This document describes how Clerk authentication is implemented in the backend API.

## Overview

The backend API uses [Clerk's Backend SDK](https://clerk.com/docs/reference/backend-api) to verify JWT tokens sent from the frontend. The authentication is handled by the `authPlugin` in `src/context.ts`.

## Implementation

### Token Verification

The `authPlugin` extracts and verifies Clerk JWT tokens from the `Authorization` header:

```typescript
const verifiedToken = await clerkClient.verifyToken(token, {
  secretKey: env.CLERK_SECRET_KEY,
});
```

### Auth Context

The verified token provides the following information in the `auth` context:

- `userId`: The user's Clerk ID (from JWT `sub` claim)
- `sessionId`: The current session ID (from JWT `sid` claim)
- `orgId`: Organization ID if user is in an organization
- `orgRole`: Organization role if applicable
- `orgSlug`: Organization slug if applicable
- `role`: Custom role from token claims (admin/staff/viewer)
- `claims`: All JWT claims for potential future use

### Authentication Requirements

All API requests require a valid Clerk JWT token in the `Authorization` header. Requests without a valid token will have `auth.userId` set to `undefined`, and routes that require authentication should check for this and return appropriate error responses.

## Authorization

### Cart Routes

Cart routes enforce authorization to ensure users can only access their own carts:

- **Guest carts** (`userId === null`): Accessible to anyone with the `cartId`
- **User carts** (`userId !== null`): Only accessible to the authenticated user who owns the cart

All cart operations (get, add items, update, delete, checkout) check authorization.

### Auction Routes

Auction bid routes require authentication and use `auth.userId` to identify the bidder. The backend automatically creates or retrieves the user record based on the Clerk `userId`.

## Frontend Integration

The frontend sends Clerk tokens via the Next.js API proxy route (`apps/web/app/api/[...path]/route.ts`):

```typescript
const { getToken } = await auth();
const token = await getToken();
if (token) {
  headers.Authorization = `Bearer ${token}`;
}
```

The proxy forwards requests to the backend API with the token in the `Authorization` header.

## Environment Variables

Required environment variables:

- `CLERK_SECRET_KEY`: Clerk secret key for token verification (required)
- `CLERK_JWT_PUBLIC_KEY`: Optional, can be used for alternative verification methods

## References

- [Clerk Backend API Reference](https://clerk.com/docs/reference/backend-api)
- [Clerk Auth Object Types](https://clerk.com/docs/reference/backend/types/auth-object)
- [Clerk Session Tokens Guide](https://clerk.com/docs/guides/sessions/session-tokens)
