import { headers } from "next/headers";

function normalizeAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `http://${value}`;
}

export async function getRequestOrigin() {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost || requestHeaders.get("host");

  if (host) {
    const forwardedProto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto =
      forwardedProto || (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }

  return normalizeAbsoluteUrl(process.env.DOMAIN || "http://localhost:3000");
}
