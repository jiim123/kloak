/**
 * Generic request deduplication utility.
 * Prevents the same query from being fired multiple times simultaneously.
 */
const genericInflight = new Map<string, Promise<any>>();

export async function deduplicatedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const existing = genericInflight.get(key);
  if (existing) return existing;

  const promise = fetcher().finally(() => {
    genericInflight.delete(key);
  });

  genericInflight.set(key, promise);
  return promise;
}
