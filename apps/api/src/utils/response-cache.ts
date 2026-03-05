type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const CACHE_ENABLED = process.env.API_RESPONSE_CACHE_ENABLED !== "false";
const CACHE_MAX_ENTRIES = Math.max(
  100,
  Number.parseInt(process.env.API_RESPONSE_CACHE_MAX_ENTRIES ?? "2000", 10) || 2000,
);

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function isExpired(entry: CacheEntry<unknown>) {
  return entry.expiresAt <= Date.now();
}

function evictIfNeeded() {
  if (cache.size <= CACHE_MAX_ENTRIES) return;

  // Prefer evicting expired entries first.
  for (const [key, entry] of cache.entries()) {
    if (isExpired(entry)) {
      cache.delete(key);
      if (cache.size <= CACHE_MAX_ENTRIES) return;
    }
  }

  // Then evict oldest entries (Map preserves insertion order).
  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (!oldestKey) return;
    cache.delete(oldestKey);
  }
}

export function getCachedResponse<T>(key: string): T | null {
  if (!CACHE_ENABLED) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (isExpired(entry)) {
    cache.delete(key);
    return null;
  }
  return entry.value as T;
}

export function setCachedResponse<T>(key: string, value: T, ttlMs: number) {
  if (!CACHE_ENABLED || ttlMs <= 0) return;
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });
  evictIfNeeded();
}

export async function withCachedResponse<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const cached = getCachedResponse<T>(key);
  if (cached !== null) return cached;

  const current = inflight.get(key);
  if (current) {
    return current as Promise<T>;
  }

  const promise = load()
    .then((value) => {
      setCachedResponse(key, value, ttlMs);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCachedResponses(predicate: (key: string) => boolean) {
  for (const key of cache.keys()) {
    if (predicate(key)) {
      cache.delete(key);
    }
  }
  for (const key of inflight.keys()) {
    if (predicate(key)) {
      inflight.delete(key);
    }
  }
}

export function invalidateCachedResponsesByPrefixes(prefixes: string[]) {
  if (prefixes.length === 0) return;
  invalidateCachedResponses((key) => prefixes.some((prefix) => key.startsWith(prefix)));
}
