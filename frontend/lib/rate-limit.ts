/**
 * Per-key sliding-window rate limiter.
 *
 * Why this exists: even with httpOnly + SameSite=Strict + AES-256-GCM
 * seal on the session cookie, the chat endpoint forwards every request
 * as a paid OpenAI call downstream. Without throttling, a runaway client
 * (retry loop, abuse, leaked cookie) drains the user's quota in seconds.
 *
 * Backend selection at module load:
 *   • If KV_REST_API_URL + KV_REST_API_TOKEN are set (Vercel's canonical
 *     names from the Upstash Marketplace integration when no custom
 *     prefix is configured): use @upstash/ratelimit sliding-window
 *     against Upstash Redis. This is the only correct option on Vercel
 *     serverless — state is shared across function instances.
 *   • Otherwise: fall back to an in-memory Map (per-Node-instance).
 *     Suitable ONLY for local dev / single-instance deployments.
 *
 * A loud console.warn fires in production if the integration vars are
 * missing, so the operator sees the gap in deploy logs.
 *
 * The call site in app/api/chat/route.ts just awaits a single
 * checkRateLimit(key) — the backend choice is invisible to it.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { serverEnv } from "@/lib/env";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;
const CLEANUP_INTERVAL_MS = 5 * 60_000;

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

// ──────────────────────────────────────────────────────────────────────
// Backend selection — done once at module load
// ──────────────────────────────────────────────────────────────────────

const upstashUrl = serverEnv.KV_REST_API_URL;
const upstashToken = serverEnv.KV_REST_API_TOKEN;
const hasUpstashCreds = upstashUrl !== undefined && upstashToken !== undefined;

const upstashLimiter: Ratelimit | null = hasUpstashCreds
  ? new Ratelimit({
      redis: new Redis({ url: upstashUrl, token: upstashToken }),
      limiter: Ratelimit.slidingWindow(MAX_REQUESTS_PER_WINDOW, `${WINDOW_MS} ms`),
      analytics: false,
      prefix: "coldplay-chat",
    })
  : null;

if (!hasUpstashCreds && serverEnv.NODE_ENV === "production") {
  // Loud, structured warning. Not an error — single-instance deployments
  // still get rate limiting, just not distributed. Operators who care
  // about correctness under autoscale will provision Upstash via the
  // Vercel Marketplace integration (no custom prefix => KV_REST_API_*).
  console.warn(
    "[rate-limit] KV_REST_API_URL / KV_REST_API_TOKEN not set. " +
      "Falling back to per-instance in-memory limiter — NOT safe for distributed deployments. " +
      "Provision Upstash from Vercel → Marketplace to fix."
  );
}

// ──────────────────────────────────────────────────────────────────────
// In-memory fallback
// ──────────────────────────────────────────────────────────────────────

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastCleanupAt = 0;

function checkInMemory(key: string): RateLimitDecision {
  pruneExpired();
  const now = Date.now();
  const existing = buckets.get(key);

  if (existing === undefined || now >= existing.resetAt) {
    const fresh: Bucket = { count: 1, resetAt: now + WINDOW_MS };
    buckets.set(key, fresh);
    return {
      allowed: true,
      remaining: MAX_REQUESTS_PER_WINDOW - 1,
      resetAt: fresh.resetAt,
      retryAfterSec: 0,
    };
  }

  if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS_PER_WINDOW - existing.count,
    resetAt: existing.resetAt,
    retryAfterSec: 0,
  };
}

function pruneExpired(): void {
  const now = Date.now();
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;
  for (const [key, bucket] of buckets.entries()) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
  lastCleanupAt = now;
}

// ──────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────

export async function checkRateLimit(key: string): Promise<RateLimitDecision> {
  if (upstashLimiter !== null) {
    const result = await upstashLimiter.limit(key);
    const now = Date.now();
    return {
      allowed: result.success,
      remaining: result.remaining,
      resetAt: result.reset,
      retryAfterSec: result.success ? 0 : Math.max(0, Math.ceil((result.reset - now) / 1000)),
    };
  }
  return checkInMemory(key);
}

/**
 * Extract a stable per-client key. On Vercel, x-forwarded-for is the
 * first hop set by the edge network; the first IP in the list is the
 * client. Falls back to x-real-ip then a generic bucket (worst case:
 * shared limit across unknown clients).
 */
export function getClientKey(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown-client";
}
