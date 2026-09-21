import { NativeModules } from 'react-native';

interface RNEncryptedStorageBridge {
  setItem: (key: string, value: string) => Promise<void>;
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export class EncryptionStorage {
  private static memoryStore = new Map<string, string>();

  private static getNativeStorage(): RNEncryptedStorageBridge | null {
    const bridge = NativeModules.RNEncryptedStorage as RNEncryptedStorageBridge | undefined;
    return bridge ?? null;
  }

  public static async setItem<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const nativeStorage = this.getNativeStorage();

      if (nativeStorage) {
        await nativeStorage.setItem(key, serialized);
        return;
      }

      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
        storage.setItem(key, serialized);
        return;
      }

      this.memoryStore.set(key, serialized);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao salvar dados criptografados na chave '${key}': ${message}`);
    }
  }

  public static async getItem<T>(key: string): Promise<T | null> {
    try {
      const nativeStorage = this.getNativeStorage();

      if (nativeStorage) {
        const data = await nativeStorage.getItem(key);
        if (!data) {
          return null;
        }
        return JSON.parse(data) as T;
      }

      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
        const data = storage.getItem(key);
        return data ? (JSON.parse(data) as T) : null;
      }

      const memoryData = this.memoryStore.get(key);
      return memoryData ? (JSON.parse(memoryData) as T) : null;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao recuperar dados criptografados da chave '${key}': ${message}`);
    }
  }

  public static async removeItem(key: string): Promise<void> {
    try {
      const nativeStorage = this.getNativeStorage();

      if (nativeStorage) {
        await nativeStorage.removeItem(key);
        return;
      }

      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
        storage.removeItem(key);
        return;
      }

      this.memoryStore.delete(key);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao remover chave criptografada '${key}': ${message}`);
    }
  }

  public static async clear(): Promise<void> {
    try {
      const nativeStorage = this.getNativeStorage();

      if (nativeStorage) {
        await nativeStorage.clear();
        return;
      }

      if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
        const storage = (globalThis as unknown as { localStorage: Storage }).localStorage;
        storage.clear();
        return;
      }

      this.memoryStore.clear();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Falha ao limpar dados criptografados: ${message}`);
    }
  }
}
