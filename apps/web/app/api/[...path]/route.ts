import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { env } from "@repo/shared";
import axios from "axios";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "PUT");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "PATCH");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "DELETE");
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxyRequest(request, params, "OPTIONS");
}

async function proxyRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string,
) {
  try {
    const { path } = await params;
    const pathname = path.join("/");
    const url = new URL(request.url);
    const searchParams = url.searchParams.toString();
    const backendUrl = `${env.BACKEND_URL}/api/${pathname}${searchParams ? `?${searchParams}` : ""}`;

    console.log(`[Proxy] ${method} ${pathname} -> ${backendUrl}`);

    // Get Clerk auth token
    const { getToken } = await auth();
    const token = await getToken();

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Add Clerk token if available
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Forward relevant headers from the original request
    const contentType = request.headers.get("content-type");
    if (contentType) {
      headers["Content-Type"] = contentType;
    }

    // Prepare axios config
    const axiosConfig: {
      method: string;
      url: string;
      headers: Record<string, string>;
      data?: unknown;
    } = {
      method: method.toLowerCase() as "get" | "post" | "put" | "patch" | "delete" | "options",
      url: backendUrl,
      headers,
    };

    // Add body for methods that support it
    if (["POST", "PUT", "PATCH"].includes(method)) {
      const body = await request.text();
      if (body) {
        try {
          axiosConfig.data = JSON.parse(body);
        } catch {
          axiosConfig.data = body;
        }
      }
    }

    // Forward request to backend using axios
    const backendResponse = await axios(axiosConfig);

    // Create response with same status and headers
    const response = NextResponse.json(backendResponse.data, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
    });

    // Forward CORS headers from backend
    const corsHeaders = [
      "access-control-allow-origin",
      "access-control-allow-credentials",
      "access-control-allow-methods",
      "access-control-allow-headers",
      "access-control-max-age",
      "vary",
    ];

    Object.entries(backendResponse.headers).forEach(([key, value]) => {
      if (corsHeaders.includes(key.toLowerCase()) && typeof value === "string") {
        response.headers.set(key, value);
      }
    });

    return response;
  } catch (error) {
    console.error("[Proxy] Error proxying request:", error);
    if (axios.isAxiosError(error)) {
      console.error("[Proxy] Axios error details:", {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });
      const status = error.response?.status ?? 500;
      const data = error.response?.data ?? {
        error: "Failed to proxy request",
        message: error.message,
        code: error.code,
      };
      return NextResponse.json(data, { status });
    }
    return NextResponse.json(
      {
        error: "Failed to proxy request",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

