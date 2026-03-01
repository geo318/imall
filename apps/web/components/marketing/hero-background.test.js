import { describe, expect, test } from "bun:test";
import {
  areIconNodesEqual,
  buildIconNodes,
  resolveIconNodesState,
  shouldRecomputeLayout,
} from "./hero-background";

describe("hero icon layout stability", () => {
  test("buildIconNodes is deterministic for same viewport size", () => {
    const first = buildIconNodes(1280, 760);
    const second = buildIconNodes(1280, 760);

    expect(first.length).toBe(8);
    expect(second.length).toBe(8);
    expect(areIconNodesEqual(first, second)).toBe(true);
  });

  test("areIconNodesEqual detects meaningful coordinate changes", () => {
    const baseline = buildIconNodes(1280, 760);
    const shifted = buildIconNodes(1290, 760);

    expect(areIconNodesEqual(baseline, shifted)).toBe(false);
  });

  test("shouldRecomputeLayout ignores tiny sub-pixel resize noise", () => {
    const previous = { width: 1280, height: 760 };

    expect(shouldRecomputeLayout(previous, { width: 1280.3, height: 760.2 })).toBe(false);
    expect(shouldRecomputeLayout(previous, { width: 1281, height: 760 })).toBe(true);
    expect(shouldRecomputeLayout(null, previous)).toBe(true);
  });

  test("resolveIconNodesState keeps previous reference when nodes are unchanged", () => {
    const previous = buildIconNodes(1280, 760);
    const next = buildIconNodes(1280, 760);

    const resolved = resolveIconNodesState(previous, next);
    expect(resolved).toBe(previous);
  });

  test("resolveIconNodesState returns new reference when nodes changed", () => {
    const previous = buildIconNodes(1280, 760);
    const next = buildIconNodes(1400, 760);

    const resolved = resolveIconNodesState(previous, next);
    expect(resolved).toBe(next);
  });
});
