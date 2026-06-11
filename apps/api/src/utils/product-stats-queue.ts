import { logger } from "./logger";
import { recordProductStatsDelta, type StatsDelta } from "./product-stats";

const FLUSH_INTERVAL_MS = Math.max(
  250,
  Number.parseInt(process.env.PRODUCT_STATS_FLUSH_INTERVAL_MS ?? "2000", 10) || 2000,
);
const MAX_PENDING_PRODUCTS = Math.max(
  100,
  Number.parseInt(process.env.PRODUCT_STATS_MAX_PENDING_PRODUCTS ?? "5000", 10) || 5000,
);

// Flush N products concurrently; keeps DB connection pool from being overwhelmed.
const FLUSH_CONCURRENCY = 25;

let started = false;
let flushing = false;
let flushTimer: ReturnType<typeof setInterval> | null = null;

const pending = new Map<string, StatsDelta>();

function mergeDelta(current: StatsDelta | undefined, delta: StatsDelta): StatsDelta {
  return {
    viewsTotal: (current?.viewsTotal ?? 0) + (delta.viewsTotal ?? 0),
    viewsUnique: (current?.viewsUnique ?? 0) + (delta.viewsUnique ?? 0),
    addedToCart: (current?.addedToCart ?? 0) + (delta.addedToCart ?? 0),
    loved: (current?.loved ?? 0) + (delta.loved ?? 0),
    sold: (current?.sold ?? 0) + (delta.sold ?? 0),
  };
}

async function flushPendingProductStats() {
  if (flushing || pending.size === 0) return;
  flushing = true;

  const snapshot = new Map(pending);
  pending.clear();

  const entries = Array.from(snapshot);

  try {
    for (let i = 0; i < entries.length; i += FLUSH_CONCURRENCY) {
      const chunk = entries.slice(i, i + FLUSH_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(([productId, delta]) => recordProductStatsDelta(productId, delta)),
      );
      results.forEach((result, j) => {
        if (result.status === "rejected") {
          const entry = chunk[j];
          if (entry) {
            const [productId, delta] = entry;
            pending.set(productId, mergeDelta(pending.get(productId), delta));
          }
        }
      });
    }
  } catch (error) {
    logger.error("[ProductStatsQueue] Flush failed:", error);
    for (const [productId, delta] of snapshot) {
      pending.set(productId, mergeDelta(pending.get(productId), delta));
    }
  } finally {
    flushing = false;
  }
}

export function enqueueProductStatsDelta(productId: string, delta: StatsDelta) {
  pending.set(productId, mergeDelta(pending.get(productId), delta));

  if (pending.size >= MAX_PENDING_PRODUCTS) {
    void flushPendingProductStats();
  }
}

export function startProductStatsQueue() {
  if (started) return;
  started = true;

  flushTimer = setInterval(() => {
    void flushPendingProductStats();
  }, FLUSH_INTERVAL_MS);

  if (typeof flushTimer.unref === "function") {
    flushTimer.unref();
  }
}
