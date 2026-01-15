# Authentication Implementation Guide

This directory contains the authentication pages and components for the application, using Clerk Elements for a custom UI experience.

## Structure

```
app/(auth)/
├── _components/
│   ├── sign-in-slot.tsx      # Sign-in form component
│   ├── sign-up-slot.tsx       # Sign-up form component
│   ├── google-icon.tsx        # Google OAuth icon component
│   └── facebook-icon.tsx      # Facebook OAuth icon component
├── sign-in/[[...index]]/      # Sign-in page route
└── sign-up/[[...index]]/      # Sign-up page route
```

## Components

### SignInSlot & SignUpSlot

These components use Clerk Elements to provide a custom authentication UI:

- **Email/Password authentication**: Standard email and password flow
- **OAuth providers**: Google and Facebook authentication
- **Email verification**: Code-based email verification
- **Password reset**: Forgot password flow

### OAuth Icons

Reusable SVG icon components for OAuth providers:
- `GoogleIcon`: Google branding icon
- `FacebookIcon`: Facebook branding icon

Both components accept a `className` prop for styling.

## Clerk Integration

### ClerkProvider Setup

The `ClerkProvider` is wrapped in a `ClerkContextProvider` component located at `app/context/clerk-provider-client.tsx`. This ensures:

1. **Client-only rendering**: Clerk only loads on the client side
2. **Ready state tracking**: Components wait for Clerk to be fully initialized via `ClerkReadyContext`
3. **Suspense boundary**: Wrapped in Suspense to prevent navigation blocking

### OAuth Flow

OAuth authentication uses Clerk's `authenticateWithRedirect` method:

```typescript
clerk.client.signIn.authenticateWithRedirect({
  strategy: "oauth_google" | "oauth_facebook",
  redirectUrl: globalThis.location.origin + "/",
  redirectUrlComplete: globalThis.location.origin + "/",
});
```

**Note**: To enable OAuth providers, configure them in your Clerk Dashboard under Social Connections.

## Layout

### Sign-in/Sign-up Pages

Both pages use a split layout:

- **Left panel** (desktop only): Branding panel with features and marketing content
- **Right panel**: Authentication form

Both panels scroll independently (`overflow-y-auto`) to handle long content gracefully.

## Styling

The authentication forms use a clean, modern design:

- **Inputs**: White background with slate borders, emerald focus states
- **Buttons**: Emerald primary buttons with proper hover states
- **OAuth buttons**: Outline style with provider icons
- **Spacing**: Consistent `space-y-6` for vertical rhythm

## Error Handling

- Components check for Clerk readiness before rendering
- Loading skeletons shown while Clerk initializes
- OAuth errors are caught and logged to console

## Future Improvements

- Add more OAuth providers (GitHub, Apple, etc.)
- Implement social login popup mode (if Clerk supports it)
- Add password strength indicator
- Add email validation feedback
