import { afterEach, describe, expect, test } from "bun:test";
import { timeoutManager, useQuery } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { queryGcTime } from "../lib/query-gc-time";
import { QueryProvider } from "./query-provider";

afterEach(() => {
  timeoutManager.setTimeoutProvider({
    setTimeout: (callback, delay) => setTimeout(callback, delay),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (callback, delay) => setInterval(callback, delay),
    clearInterval: (id) => clearInterval(id),
  });
});

describe("SSR query cache lifetime", () => {
  test("repeated renders don't retain request caches through GC timers", () => {
    let timerCount = 0;
    timeoutManager.setTimeoutProvider({
      setTimeout: () => ++timerCount,
      clearTimeout: () => {},
      setInterval: () => 0,
      clearInterval: () => {},
    });

    function Queries() {
      useQuery({ queryKey: ["default"], queryFn: async () => [] });
      useQuery({
        queryKey: ["categories-tree", "ka"],
        queryFn: async () => [],
        gcTime: queryGcTime(2 * 60 * 60_000),
      });
      useQuery({
        queryKey: ["cart", null],
        queryFn: async () => [],
        enabled: false,
        gcTime: queryGcTime(10 * 60_000),
      });
      return null;
    }

    for (let request = 0; request < 100; request++) {
      renderToString(
        <QueryProvider>
          <Queries />
        </QueryProvider>,
      );
    }
    expect(timerCount).toBe(0);
  });
});
