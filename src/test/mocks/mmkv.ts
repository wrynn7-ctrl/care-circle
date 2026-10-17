// In-memory stand-in for react-native-mmkv in Jest.
type Store = Map<string, string | number | boolean>;

export type MMKV = {
  set: (key: string, value: string | number | boolean) => void;
  getString: (key: string) => string | undefined;
  getNumber: (key: string) => number | undefined;
  getBoolean: (key: string) => boolean | undefined;
  remove: (key: string) => boolean;
  contains: (key: string) => boolean;
  clearAll: () => void;
  getAllKeys: () => string[];
};

// State lives on globalThis so tests that isolate module registries still see one shared store.
const g = globalThis as unknown as {
  __mmkvStores?: Map<string, Store>;
  __mmkvKeys?: Map<string, string | undefined>;
};
const stores = (g.__mmkvStores ??= new Map<string, Store>());
export const __encryptionKeys = (g.__mmkvKeys ??= new Map<string, string | undefined>());

export function createMMKV(config?: { id?: string; encryptionKey?: string }): MMKV {
  const id = config?.id ?? 'mmkv.default';
  __encryptionKeys.set(id, config?.encryptionKey);
  const store = stores.get(id) ?? new Map();
  stores.set(id, store);
  return {
    set: (k, v) => void store.set(k, v),
    getString: (k) => (typeof store.get(k) === 'string' ? (store.get(k) as string) : undefined),
    getNumber: (k) => (typeof store.get(k) === 'number' ? (store.get(k) as number) : undefined),
    getBoolean: (k) => (typeof store.get(k) === 'boolean' ? (store.get(k) as boolean) : undefined),
    remove: (k) => store.delete(k),
    contains: (k) => store.has(k),
    clearAll: () => store.clear(),
    getAllKeys: () => [...store.keys()],
  };
}
