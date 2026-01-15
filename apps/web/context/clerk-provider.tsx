// Read directly from process.env - NEXT_PUBLIC_ vars are available at build time
// Making this synchronous to avoid "uncached data" errors during build
// During build, Next.js injects NEXT_PUBLIC_ vars, so this should be safe
export function getClerkPublishableKey(): string {
  // Use a type assertion to tell Next.js this is a build-time constant
  const key = (process.env as { NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string }).NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return key || "";
}
