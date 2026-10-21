export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

interface FailureEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory failure counter per key (ip + email). Fine for a single process;
 * use a shared store such as Redis once the API runs on more than one instance.
 */
export function createRateLimiter({
  max = LOGIN_MAX_FAILURES,
  windowMs = LOGIN_WINDOW_MS,
  now = Date.now,
}: { max?: number; windowMs?: number; now?: () => number } = {}) {
  const failures = new Map<string, FailureEntry>();

  function current(key: string): FailureEntry | undefined {
    const entry = failures.get(key);
    if (entry && entry.resetAt <= now()) {
      failures.delete(key);
      return undefined;
    }
    return entry;
  }

  return {
    isBlocked(key: string): boolean {
      return (current(key)?.count ?? 0) >= max;
    },
    recordFailure(key: string): void {
      const entry = current(key);
      if (entry) entry.count++;
      else failures.set(key, { count: 1, resetAt: now() + windowMs });
    },
    reset(key: string): void {
      failures.delete(key);
    },
  };
}
