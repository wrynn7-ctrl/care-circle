import { QueryClient, dehydrate } from '@tanstack/react-query';
import {
  persistQueryClient,
  persistQueryClientRestore,
} from '@tanstack/react-query-persist-client';

import {
  QUERY_CACHE_BUSTER,
  QUERY_CACHE_KEY,
  createAppPersister,
  createAppQueryClient,
} from '../queryClient';

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}

// The persister batches writes on a timer; give it a tick to flush.
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('query cache persistence', () => {
  const clients: QueryClient[] = [];
  const track = (c: QueryClient) => {
    clients.push(c);
    return c;
  };
  // Queries schedule long gc timers; clearing the clients lets Jest exit cleanly.
  afterEach(() => {
    for (const c of clients) c.clear();
    clients.length = 0;
  });

  it('writes the cache to storage and restores it into a fresh client', async () => {
    const storage = memoryStorage();
    const persister = createAppPersister(storage, { throttleTime: 0 });
    const client = track(createAppQueryClient());
    client.setQueryData(['tasks', 'circle-1'], [{ id: 't1', title: 'Call insurance' }]);

    await persister.persistClient({
      buster: QUERY_CACHE_BUSTER,
      timestamp: Date.now(),
      clientState: dehydrate(client),
    });
    await flush();
    expect(storage.raw.has(QUERY_CACHE_KEY)).toBe(true);

    const fresh = track(new QueryClient());
    await persistQueryClientRestore({ queryClient: fresh, persister, buster: QUERY_CACHE_BUSTER });
    expect(fresh.getQueryData(['tasks', 'circle-1'])).toEqual([
      { id: 't1', title: 'Call insurance' },
    ]);
  });

  it('drops a cache written with a different buster', async () => {
    const storage = memoryStorage();
    const persister = createAppPersister(storage, { throttleTime: 0 });
    const client = track(createAppQueryClient());
    const [unsubscribe, restored] = persistQueryClient({
      queryClient: client,
      persister,
      buster: 'old-shape',
    });
    await restored; // subscription to cache changes starts once the initial restore finishes
    client.setQueryData(['meds'], ['x']);
    await flush();
    unsubscribe();
    expect(storage.raw.has(QUERY_CACHE_KEY)).toBe(true);

    const fresh = track(new QueryClient());
    await persistQueryClientRestore({ queryClient: fresh, persister, buster: QUERY_CACHE_BUSTER });
    expect(fresh.getQueryData(['meds'])).toBeUndefined();
    expect(storage.raw.has(QUERY_CACHE_KEY)).toBe(false);
  });

  it('uses offline-first network mode so cached data renders without signal', () => {
    const client = track(createAppQueryClient());
    expect(client.getDefaultOptions().queries?.networkMode).toBe('offlineFirst');
    expect(client.getDefaultOptions().mutations?.networkMode).toBe('offlineFirst');
  });
});
