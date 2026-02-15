import { resolveBackendBase } from "../../_utils/backend";

const API_BASE = resolveBackendBase();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const params = new URLSearchParams();
  if (locale) params.set("locale", locale);

  const backendUrl = `${API_BASE}/api/categories/tree${params.toString() ? `?${params}` : ""}`;
  const response = await fetch(backendUrl, { cache: "no-store" });

  if (!response.ok) {
    const text = await response.text().catch(() => "Failed to load categories");
    return new Response(text, { status: response.status });
  }

  const data = await response.json();
  return Response.json(data);
}
