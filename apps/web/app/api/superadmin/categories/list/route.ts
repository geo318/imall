import { superadminProxy } from "../../utils";

export async function GET() {
  const response = await superadminProxy("/superadmin/categories/list");
  if (!response.ok) {
    const message = await response.text().catch(() => "Failed to load categories");
    return new Response(message, { status: response.status });
  }
  const data = await response.json();
  return Response.json(data);
}
