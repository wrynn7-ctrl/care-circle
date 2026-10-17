import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * On-device key/value storage for the auth session and the offline query cache.
 *
 * Design (architecture §7–§8): everything cached on the device is encrypted. MMKV encrypts the store with a
 * key that lives in the OS keychain/keystore (expo-secure-store). SecureStore itself caps values at 2 KB,
 * which is too small for a Supabase session, so it holds only the 32-byte key.
 *
 * Web (development and screenshots only, never a shipping target) has no secure enclave; MMKV falls back
 * to localStorage without encryption and `isEncrypted` reports false.
 */
const KEY_NAME = 'cc.storage.key.v1';
const STORE_ID = 'care-circle';

let instance: MMKV | null = null;
let encrypted = false;

async function loadOrCreateKey(): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const available = await SecureStore.isAvailableAsync();
  if (!available) return null;
  const existing = await SecureStore.getItemAsync(KEY_NAME);
  if (existing) return existing;
  const bytes = Crypto.getRandomBytes(32);
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, key, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

/** Call once at startup, before anything reads storage. Safe to call again (no-op). */
export async function initStorage(): Promise<MMKV> {
  if (instance) return instance;
  const key = await loadOrCreateKey();
  instance = key ? createMMKV({ id: STORE_ID, encryptionKey: key }) : createMMKV({ id: STORE_ID });
  encrypted = key !== null;
  return instance;
}

export function getStorage(): MMKV {
  if (!instance) throw new Error('initStorage() must complete before storage is used.');
  return instance;
}

export function isStorageEncrypted(): boolean {
  return encrypted;
}

/** Wipes everything cached on this device (sign-out, account deletion). */
export function clearStorage(): void {
  instance?.clearAll();
}

/** Adapter in the shape supabase-js and TanStack Query expect (sync, Storage-like). */
export const kvAdapter = {
  getItem: (key: string): string | null => getStorage().getString(key) ?? null,
  setItem: (key: string, value: string): void => {
    getStorage().set(key, value);
  },
  removeItem: (key: string): void => {
    getStorage().remove(key);
  },
};
