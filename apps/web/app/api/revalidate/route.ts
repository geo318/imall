import { revalidatePath, revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { CACHE_TAGS, safeTag } from "@/lib/constants";

/**
 * API route for revalidating caches after mutations
 * Called from client components after successful mutations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tags, paths } = body;

    // Revalidate tags
    if (tags && Array.isArray(tags)) {
      for (const tag of tags) {
        // Only allow revalidation of known tags (security)
        const validTag = tag as (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
        if (
          Object.values(CACHE_TAGS).includes(validTag) ||
          tag.startsWith(`${CACHE_TAGS.PRODUCT}-`) ||
          tag.startsWith(`${CACHE_TAGS.SHOP}-`) ||
          tag.startsWith(`${CACHE_TAGS.CART}-`)
        ) {
          revalidateTag(safeTag(tag), "max");
        }
      }
    }

    // Revalidate paths
    if (paths && Array.isArray(paths)) {
      for (const path of paths) {
        revalidatePath(path, "page");
      }
    }

    return NextResponse.json({ revalidated: true, now: Date.now() });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Error revalidating",
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
