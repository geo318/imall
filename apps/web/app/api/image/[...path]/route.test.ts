import { afterEach, describe, expect, mock, test } from "bun:test";
import { GET } from "./route";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("image proxy resource use", () => {
  test("streams images without buffering them in Next's data cache", async () => {
    let reads = 0;
    const body = new ReadableStream(
      {
        pull(controller) {
          reads++;
          controller.enqueue(new TextEncoder().encode("image"));
          controller.close();
        },
      },
      { highWaterMark: 0 },
    );
    const fetchMock = mock(async (_url: unknown, init?: RequestInit) => {
      expect(init?.cache).toBe("no-store");
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      return new Response(body, {
        headers: { "content-type": "image/webp", "cache-control": "public, max-age=3600" },
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const response = await GET(new Request("https://imall.ge/api/image/shop/photo.webp"), {
      params: Promise.resolve({ path: ["shop", "photo.webp"] }),
    });
    expect(reads).toBe(0);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await response.text()).toBe("image");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("cancels discarded 404 bodies before retrying legacy filenames", async () => {
    let cancelled = false;
    let calls = 0;
    globalThis.fetch = mock(async (_url: unknown, init?: RequestInit) => {
      expect(init?.cache).toBe("no-store");
      if (++calls === 1) {
        return new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
          { status: 404 },
        );
      }
      expect(cancelled).toBe(true);
      expect(String(_url)).toEndWith("/shop/photo.webp");
      return new Response("image");
    }) as unknown as typeof fetch;

    const response = await GET(new Request("https://imall.ge/api/image/shop/photo.webp-0"), {
      params: Promise.resolve({ path: ["shop", "photo.webp-0"] }),
    });
    expect(await response.text()).toBe("image");
    expect(calls).toBe(2);
  });

  test("returns an uncached gateway error when the upstream fails", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    const response = await GET(new Request("https://imall.ge/api/image/shop/photo.webp"), {
      params: Promise.resolve({ path: ["shop", "photo.webp"] }),
    });
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
