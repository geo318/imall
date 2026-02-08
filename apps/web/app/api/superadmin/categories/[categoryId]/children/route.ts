import { superadminProxy } from "../../../utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  const { categoryId } = await params;
  if (!categoryId || categoryId === "undefined") {
    return new Response("Missing category id", { status: 400 });
  }

  const response = await superadminProxy(
    `/superadmin/categories/${encodeURIComponent(categoryId)}/children`,
  );
  if (!response.ok) {
    const message = await response.text().catch(() => "Failed to load categories");
    return new Response(message, { status: response.status });
  }
  const data = await response.json();
  return Response.json(data);
}
