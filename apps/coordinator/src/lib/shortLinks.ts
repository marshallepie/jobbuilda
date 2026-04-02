import { randomBytes } from 'crypto';

interface ShortLink {
  url: string;
  expiresAt: number; // epoch ms
}

const store = new Map<string, ShortLink>();

/** Generate a short key and store the target URL. Returns the key. */
export function createShortLink(targetUrl: string, ttlMs: number): string {
  // Purge expired entries lazily
  const now = Date.now();
  for (const [key, link] of store.entries()) {
    if (link.expiresAt <= now) store.delete(key);
  }

  const key = randomBytes(5).toString('base64url'); // ~7 chars, URL-safe
  store.set(key, { url: targetUrl, expiresAt: now + ttlMs });
  return key;
}

/** Resolve a key to its target URL, or null if missing/expired. */
export function resolveShortLink(key: string): string | null {
  const link = store.get(key);
  if (!link) return null;
  if (link.expiresAt <= Date.now()) {
    store.delete(key);
    return null;
  }
  return link.url;
}
