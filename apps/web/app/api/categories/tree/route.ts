import { resolveBackendBase } from "../../_utils/backend";

const API_BASE = resolveBackendBase();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const params = new URLSearchParams();
  if (locale) params.set("locale", locale);

  const backendUrl = `${API_BASE}/api/categories/tree${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(backendUrl, {
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    return new Response(response.body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
        "cache-control":
          response.headers.get("cache-control") ??
          "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
      "cache-control":
        response.headers.get("cache-control") ??
        "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
