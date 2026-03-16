import { use, useSyncExternalStore } from 'react'

type Fetcher = (...args: any[]) => Promise<any>
type Fetchers = Record<string, Fetcher>
type FetcherReturn<F> = F extends (...args: any[]) => Promise<infer R> ? R : never
type FetcherArgs<F> = F extends (...args: infer A) => any ? A : never

/**
 * React-aware Suspense cache for async data fetching.
 *
 * - Caches promises by key+args, deduplicates in-flight requests
 * - Integrates with React via useSyncExternalStore — invalidation triggers re-renders
 * - Components use the `useData` hook which calls React 19's `use()` internally
 * - Eviction prevents unbounded memory growth
 */
export interface SuspenseCache<F extends Fetchers> {
  /**
   * React hook: returns resolved data, suspends if pending, throws if rejected.
   * Must be called inside a <Suspense> boundary.
   */
  useData<K extends keyof F & string>(key: K, ...args: FetcherArgs<F[K]>): FetcherReturn<F[K]>

  /** Invalidate a specific cache entry. Triggers re-render → re-suspend. */
  invalidate<K extends keyof F & string>(key: K, ...args: FetcherArgs<F[K]>): void

  /** Invalidate all entries for a given fetcher key. */
  invalidateAll<K extends keyof F & string>(key: K): void

  /** Remove a specific cache entry without triggering re-renders. Use on cleanup. */
  evict<K extends keyof F & string>(key: K, ...args: FetcherArgs<F[K]>): void
}

export function createSuspenseCache<F extends Fetchers>(fetchers: F): SuspenseCache<F> {
  const cache = new Map<string, Promise<any>>()
  const listeners = new Set<() => void>()
  // Version counter — useSyncExternalStore uses this to detect changes
  let version = 0

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }

  function getSnapshot(): number {
    return version
  }

  function notify(): void {
    version++
    listeners.forEach((l) => l())
  }

  function cacheKey(key: string, args: unknown[]): string {
    return args.length === 0 ? key : `${key}:${JSON.stringify(args)}`
  }

  function getOrFetch(key: string, args: unknown[]): Promise<any> {
    const k = cacheKey(key, args)
    let promise = cache.get(k)
    if (!promise) {
      const fetcher = fetchers[key]
      promise = fetcher(...args)
      // Prevent unhandled rejection warnings. The original promise still rejects —
      // use() will re-throw into the error boundary. Failed entries stay in cache
      // until explicitly invalidated (allows error boundary to catch and display).
      promise.catch(() => {})
      cache.set(k, promise)
    }
    return promise
  }

  return {
    useData(key, ...args) {
      // Subscribe to cache changes so invalidation triggers re-render
      useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
      const promise = getOrFetch(key, args)
      return use(promise)
    },

    invalidate(key, ...args) {
      const k = cacheKey(key, args)
      if (cache.delete(k)) notify()
    },

    invalidateAll(key) {
      const prefix = `${key}:`
      let deleted = false
      for (const k of cache.keys()) {
        if (k === key || k.startsWith(prefix)) {
          cache.delete(k)
          deleted = true
        }
      }
      if (deleted) notify()
    },

    evict(key, ...args) {
      cache.delete(cacheKey(key, args))
    },
  }
}
