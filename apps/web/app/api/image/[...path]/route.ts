import { resolveBackendBase } from "@/app/api/_utils/backend";

type Params = {
  path?: string[];
};

const CORRUPTED_IMAGE_INDEX_SUFFIX_RE = /(\.(?:webp|png|jpe?g|gif|svg))(?:-\d+)+$/i;

function forwardImageHeaders(source: Headers) {
  const headers = new Headers();
  const passThrough = [
    "content-type",
    "content-length",
    "cache-control",
    "etag",
    "last-modified",
    "accept-ranges",
    "content-range",
  ];

  for (const name of passThrough) {
    const value = source.get(name);
    if (value) {
      headers.set(name, value);
    }
  }

  return headers;
}

function buildBackendImageUrl(path: string[], search: string) {
  const backendBase = resolveBackendBase().replace(/\/+$/, "");
  const joinedPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  return `${backendBase}/api/image/${joinedPath}${search}`;
}

function normalizePathSegments(path: string[]) {
  if (path.length === 0) return path;
  const next = [...path];
  const last = next.at(-1);
  if (!last) return path;

  const normalized = last.replace(CORRUPTED_IMAGE_INDEX_SUFFIX_RE, "$1");
  if (normalized === last) {
    return path;
  }

  next[next.length - 1] = normalized;
  return next;
}

async function proxyImageRequest(
  request: Request,
  { params }: { params: Promise<Params> },
  method: "GET" | "HEAD",
) {
  const resolved = await params;
  const path = resolved.path ?? [];

  if (path.length === 0) {
    return new Response("NOT_FOUND", { status: 404 });
  }

  const url = new URL(request.url);
  const normalizedPath = normalizePathSegments(path);
  const backendUrl = buildBackendImageUrl(path, url.search);
  const requestHeaders = new Headers();

  const accept = request.headers.get("accept");
  if (accept) {
    requestHeaders.set("accept", accept);
  }
  const acceptEncoding = request.headers.get("accept-encoding");
  if (acceptEncoding) {
    requestHeaders.set("accept-encoding", acceptEncoding);
  }
  const range = request.headers.get("range");
  if (range) {
    requestHeaders.set("range", range);
  }
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    requestHeaders.set("if-none-match", ifNoneMatch);
  }
  const ifModifiedSince = request.headers.get("if-modified-since");
  if (ifModifiedSince) {
    requestHeaders.set("if-modified-since", ifModifiedSince);
  }

  let upstream = await fetch(backendUrl, {
    method,
    headers: requestHeaders,
    cache: "force-cache",
  });

  if (upstream.status === 404 && normalizedPath !== path) {
    const normalizedBackendUrl = buildBackendImageUrl(normalizedPath, url.search);
    upstream = await fetch(normalizedBackendUrl, {
      method,
      headers: requestHeaders,
      cache: "force-cache",
    });
  }

  const headers = forwardImageHeaders(upstream.headers);
  return new Response(method === "HEAD" ? null : upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  return proxyImageRequest(request, context, "GET");
}

export async function HEAD(request: Request, context: { params: Promise<Params> }) {
  return proxyImageRequest(request, context, "HEAD");
}
