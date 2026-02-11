/**
 * Client-side cache utility for fetch requests
 * Provides in-memory caching with TTL (time-to-live)
 */

type CacheEntry<T> = {
  data: T;
  timestamp: number;
  ttl: number;
};

class ClientCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private maxSize: number;

  constructor(maxSize = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;

    // Check if cache has expired
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry with TTL (in milliseconds)
   */
  set<T>(key: string, data: T, ttl: number): void {
    // Limit cache size (FIFO eviction)
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }
}

// Singleton instance
const clientCache = new ClientCache();

/**
 * Cached fetch with in-memory caching
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param ttl - Cache TTL in milliseconds (default: 5 minutes)
 */
export async function cachedFetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttl: number = 300000, // 5 minutes default
): Promise<T> {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`;

  // Try to get from cache
  const cached = clientCache.get<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Fetch from network
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = (await response.json()) as T;

  // Store in cache
  clientCache.set(cacheKey, data, ttl);

  return data;
}

/**
 * Invalidate cache for specific URL
 */
export function invalidateCache(url: string, options?: RequestInit): void {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`;
  clientCache.delete(cacheKey);
}

/**
 * Clear all cache
 */
export function clearAllCache(): void {
  clientCache.clear();
}

/**
 * Prefetch and cache a URL
 */
export async function prefetch<T = unknown>(
  url: string,
  options?: RequestInit,
  ttl?: number,
): Promise<void> {
  try {
    await cachedFetch<T>(url, options, ttl);
  } catch (error) {
    console.error(`Prefetch failed for ${url}:`, error);
  }
}

export default clientCache;
