import { LRUCache } from 'lru-cache';

const rateLimitCache = new LRUCache<string, number[]>({
  max: 1000, // Track up to 1000 IPs
  ttl: 1000 * 60 * 60, // 1 hour
});

export function isRateLimited(ip: string, limit: number = 10, window: number = 60000): boolean {
  const now = Date.now();
  const key = `${ip}:${window}`;

  const requests = rateLimitCache.get(key) || [];

  // Clean old requests outside the window
  const recentRequests = requests.filter(timestamp => now - timestamp < window);

  if (recentRequests.length >= limit) {
    return true;
  }

  // Add current request
  recentRequests.push(now);
  rateLimitCache.set(key, recentRequests);

  return false;
}

export function getRemainingRequests(ip: string, limit: number = 10, window: number = 60000): number {
  const now = Date.now();
  const key = `${ip}:${window}`;

  const requests = rateLimitCache.get(key) || [];
  const recentRequests = requests.filter(timestamp => now - timestamp < window);

  return Math.max(0, limit - recentRequests.length);
}