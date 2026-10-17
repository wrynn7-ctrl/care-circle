import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

export const QUERY_CACHE_KEY = 'cc.query-cache.v1';
/** Bump when the shape of cached data changes incompatibly; old caches are dropped on restore. */
export const QUERY_CACHE_BUSTER = 'phase0';

type SyncStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Hospital waiting rooms: show what we have, refetch when we can.
        networkMode: 'offlineFirst',
        staleTime: 30_000,
        gcTime: 1000 * 60 * 60 * 24 * 7,
        retry: 2,
      },
      mutations: {
        networkMode: 'offlineFirst',
        retry: 3,
      },
    },
  });
}

/** Persists the query cache to the encrypted store so the app opens with data while offline. */
export function createAppPersister(storage: SyncStorage, options: { throttleTime?: number } = {}) {
  return createSyncStoragePersister({
    storage,
    key: QUERY_CACHE_KEY,
    throttleTime: options.throttleTime ?? 1000,
  });
}
