/**
 * Generic request deduplication utility.
 * Prevents the same query from being fired multiple times simultaneously.
 */
const DEDUPE_STALE_MS = 35_000;
const genericInflight = new Map<string, { promise: Promise<unknown>; startedAt: number }>();

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = genericInflight.get(key);
  if (existing) {
    if (Date.now() - existing.startedAt < DEDUPE_STALE_MS) {
      return existing.promise as Promise<T>;
    }
    genericInflight.delete(key);
  }

  const promise = fetcher().finally(() => {
    const current = genericInflight.get(key);
    if (current?.promise === promise) {
      genericInflight.delete(key);
    }
  });

  genericInflight.set(key, { promise, startedAt: Date.now() });
  return promise;
}
