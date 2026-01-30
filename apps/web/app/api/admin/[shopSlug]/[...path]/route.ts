import { type NextRequest, NextResponse } from "next/server";
import { backendRequest } from "@/app/api/admin/utils";

const AUTH_ERROR_MESSAGE = "Authentication required. Please sign in to access admin features.";

async function handleBackendError(response: Response, fallback: string) {
  const errorText = await response.text();
  return NextResponse.json({ error: errorText || fallback }, { status: response.status });
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ shopSlug: string; path?: string[] }>,
) {
  try {
    const { shopSlug, path } = await params;
    const suffix = path?.length ? `/${path.join("/")}` : "";
    const search = request.nextUrl.search ?? "";
    const method = request.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    const body =
      method === "GET" || method === "DELETE" ? undefined : await request.json().catch(() => undefined);

    const response = await backendRequest(`/admin/${shopSlug}${suffix}${search}`, {
      method,
      body,
    });

    if (!response.ok) {
      return await handleBackendError(response, "Failed to process admin request");
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    if (errorMessage.includes("Unauthorized")) {
      return NextResponse.json({ error: AUTH_ERROR_MESSAGE }, { status: 401 });
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; path?: string[] }> },
) {
  return proxyRequest(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; path?: string[] }> },
) {
  return proxyRequest(request, params);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; path?: string[] }> },
) {
  return proxyRequest(request, params);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; path?: string[] }> },
) {
  return proxyRequest(request, params);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; path?: string[] }> },
) {
  return proxyRequest(request, params);
}
