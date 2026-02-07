import { backendRequest } from "../../admin/utils";

export async function GET() {
  try {
    const response = await backendRequest("/shops/mine");
    const data = await response.json().catch(() => []);
    return Response.json(data, { status: response.status });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unauthorized" },
      { status: 401 },
    );
  }
}
