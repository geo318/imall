import { describe, expect, test } from "bun:test";
import { createPriceRangeHandlers, resolveDraftPriceRange } from "./product-filter-sidebar";

describe("product-filter-sidebar price range behavior", () => {
  test("resolveDraftPriceRange keeps reference when incoming range is unchanged", () => {
    const current = [0, 500];
    const incoming = [0, 500];

    const resolved = resolveDraftPriceRange(current, incoming);
    expect(resolved).toBe(current);
  });

  test("resolveDraftPriceRange returns incoming range when value changed", () => {
    const current = [0, 500];
    const incoming = [50, 400];

    const resolved = resolveDraftPriceRange(current, incoming);
    expect(resolved).toBe(incoming);
  });

  test("draft slider movement updates local state only, commit triggers parent change", () => {
    const draftCalls = [];
    const commitCalls = [];

    const handlers = createPriceRangeHandlers(
      (range) => draftCalls.push(range),
      (range) => commitCalls.push(range),
    );

    handlers.onDraftChange([40, 300]);
    expect(draftCalls).toEqual([[40, 300]]);
    expect(commitCalls).toEqual([]);

    handlers.onCommit([40, 300]);
    expect(commitCalls).toEqual([[40, 300]]);
  });
});
