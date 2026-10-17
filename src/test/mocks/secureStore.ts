const g = globalThis as unknown as { __secureStoreValues?: Map<string, string> };
const values = (g.__secureStoreValues ??= new Map<string, string>());
export const AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY = 1;
export async function isAvailableAsync() {
  return true;
}
export async function getItemAsync(key: string) {
  return values.get(key) ?? null;
}
export async function setItemAsync(key: string, value: string) {
  values.set(key, value);
}
export async function deleteItemAsync(key: string) {
  values.delete(key);
}
export function __reset() {
  values.clear();
}
