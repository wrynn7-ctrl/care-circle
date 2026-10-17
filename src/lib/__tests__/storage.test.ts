import { __encryptionKeys } from '@/test/mocks/mmkv';
import * as secure from '@/test/mocks/secureStore';

type StorageModule = typeof import('../storage');
function loadStorage(): StorageModule {
  let mod!: StorageModule;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- isolateModules needs require
    mod = require('../storage') as StorageModule;
  });
  return mod;
}

describe('encrypted storage', () => {
  beforeEach(() => {
    secure.__reset();
    __encryptionKeys.clear();
  });

  it('creates a 32-byte key in SecureStore and opens MMKV with it', async () => {
    const { initStorage, isStorageEncrypted, kvAdapter } = loadStorage();
    await initStorage();
    const key = await secure.getItemAsync('cc.storage.key.v1');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(__encryptionKeys.get('care-circle')).toBe(key);
    expect(isStorageEncrypted()).toBe(true);
    kvAdapter.setItem('a', 'b');
    expect(kvAdapter.getItem('a')).toBe('b');
    kvAdapter.removeItem('a');
    expect(kvAdapter.getItem('a')).toBeNull();
  });

  it('reuses the existing key on later launches', async () => {
    await secure.setItemAsync('cc.storage.key.v1', 'f'.repeat(64));
    const { initStorage } = loadStorage();
    await initStorage();
    expect(__encryptionKeys.get('care-circle')).toBe('f'.repeat(64));
  });

  it('throws if used before init', async () => {
    const { kvAdapter } = loadStorage();
    expect(() => kvAdapter.getItem('x')).toThrow(/initStorage/);
  });
});
