import Redis from "ioredis";

/**
 * 统一缓存与速率限制适配层
 * - 当配置了 REDIS_URL 时，使用 Redis 执行跨实例缓存与原子计数限流。
 * - 当未配置 REDIS_URL 时，自动降级至带容量上限与 TTL 过期的进程内 LRU 缓存，方便轻量部署。
 */

export interface CacheAdapter {
  readonly driver: "redis" | "memory-lru";
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  del(key: string): Promise<void>;
  checkRateLimit(
    bucketKey: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }>;
  ping(): Promise<boolean>;
}

interface MemoryEntry {
  raw: string;
  expiresAt: number;
}

class MemoryLruCacheAdapter implements CacheAdapter {
  public readonly driver = "memory-lru" as const;
  private readonly store = new Map<string, MemoryEntry>();
  private readonly counters = new Map<
    string,
    { count: number; expiresAt: number }
  >();
  private readonly maxItems: number;

  constructor(maxItems = 2000) {
    this.maxItems = maxItems;
  }

  async get<T>(key: string): Promise<T | null> {
    const item = this.store.get(key);
    if (!item) return null;
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    // 刷新 LRU 顺序
    this.store.delete(key);
    this.store.set(key, item);
    return JSON.parse(item.raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    if (this.store.size >= this.maxItems) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      raw: JSON.stringify(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async checkRateLimit(
    bucketKey: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
    const now = Date.now();
    const existing = this.counters.get(bucketKey);
    if (!existing || now > existing.expiresAt) {
      const expiresAt = now + windowSeconds * 1000;
      this.counters.set(bucketKey, { count: 1, expiresAt });
      return {
        allowed: true,
        remaining: Math.max(0, maxRequests - 1),
        resetInSeconds: windowSeconds,
      };
    }

    existing.count += 1;
    const resetInSeconds = Math.max(
      1,
      Math.ceil((existing.expiresAt - now) / 1000)
    );
    return {
      allowed: existing.count <= maxRequests,
      remaining: Math.max(0, maxRequests - existing.count),
      resetInSeconds,
    };
  }

  async ping(): Promise<boolean> {
    return true;
  }
}

class RedisCacheAdapter implements CacheAdapter {
  public readonly driver = "redis" as const;
  private readonly client: Redis;

  constructor(redisUrl: string) {
    this.client = new Redis(redisUrl, {
      maxRetriesPerRequest: 2,
      connectTimeout: 4000,
      lazyConnect: true,
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async checkRateLimit(
    bucketKey: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number; resetInSeconds: number }> {
    const key = `rl:${bucketKey}`;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    const ttl = await this.client.ttl(key);
    return {
      allowed: count <= maxRequests,
      remaining: Math.max(0, maxRequests - count),
      resetInSeconds: ttl > 0 ? ttl : windowSeconds,
    };
  }

  async ping(): Promise<boolean> {
    try {
      const res = await this.client.ping();
      return res === "PONG";
    } catch {
      return false;
    }
  }
}

interface GlobalCacheHolder {
  __omnikitCache?: CacheAdapter;
}

const globalForCache = globalThis as unknown as GlobalCacheHolder;

export function getCacheStore(): CacheAdapter {
  if (!globalForCache.__omnikitCache) {
    const redisUrl = (process.env.REDIS_URL || "").trim();
    globalForCache.__omnikitCache = redisUrl
      ? new RedisCacheAdapter(redisUrl)
      : new MemoryLruCacheAdapter();
  }
  return globalForCache.__omnikitCache;
}
