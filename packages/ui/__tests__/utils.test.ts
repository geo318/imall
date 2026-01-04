import { describe, expect, test } from "bun:test";
import { cn } from "../src/utils";

describe("cn utility", () => {
  test("merges class names with truthy filtering", () => {
    const result = cn("btn", false && "hidden", undefined, "text", "px-4");
    expect(result).toBe("btn text px-4");
  });

  test("tailwind-merge wins last for conflicts", () => {
    const result = cn("p-2 text-sm", "p-4");
    expect(result).toBe("text-sm p-4");
  });
});
