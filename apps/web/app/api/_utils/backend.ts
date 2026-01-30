export function resolveBackendBase() {
  const raw =
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:3001";

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `http://${raw}`;
}
