import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DatabaseManager } from '../data/database/SQLiteDatabase';

export const PRIVACY_SETTING_KEY = 'privacy_mode_enabled';

type PrivacyListener = (enabled: boolean) => void;

export class PrivacyManager {
  private static enabled = false;
  private static listeners = new Set<PrivacyListener>();

  public static isPrivacyEnabled(): boolean {
    return PrivacyManager.enabled;
  }

  public static subscribe(listener: PrivacyListener): () => void {
    PrivacyManager.listeners.add(listener);
    return () => {
      PrivacyManager.listeners.delete(listener);
    };
  }

  private static notify(): void {
    for (const listener of PrivacyManager.listeners) {
      listener(PrivacyManager.enabled);
    }
  }

  public static async loadPersistedPrivacyMode(): Promise<boolean> {
    try {
      const db = DatabaseManager.getInstance();
      const res = await db.executeQuery(
        'SELECT key, value FROM app_settings WHERE key = ?;',
        [PRIVACY_SETTING_KEY]
      );
      if (res.rows.length > 0) {
        const row = res.rows.item(0) as { value?: string };
        PrivacyManager.enabled = row.value === 'true' || row.value === '1';
      } else {
        PrivacyManager.enabled = false;
      }
    } catch {
      PrivacyManager.enabled = false;
    }
    PrivacyManager.notify();
    return PrivacyManager.enabled;
  }

  public static async setPrivacyEnabled(value: boolean): Promise<boolean> {
    PrivacyManager.enabled = value;
    PrivacyManager.notify();
    try {
      const db = DatabaseManager.getInstance();
      await db.executeQuery(
        'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?);',
        [PRIVACY_SETTING_KEY, value ? 'true' : 'false']
      );
    } catch {}
    return PrivacyManager.enabled;
  }

  public static async togglePrivacyMode(): Promise<boolean> {
    return PrivacyManager.setPrivacyEnabled(!PrivacyManager.enabled);
  }
}

export interface PrivacyContextValue {
  isPrivacyEnabled: boolean;
  togglePrivacyMode: () => Promise<void>;
  setPrivacyMode: (enabled: boolean) => Promise<void>;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  isPrivacyEnabled: false,
  togglePrivacyMode: async () => {},
  setPrivacyMode: async () => {},
});

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivacyEnabled, setIsPrivacyEnabled] = useState<boolean>(
    PrivacyManager.isPrivacyEnabled()
  );

  useEffect(() => {
    PrivacyManager.loadPersistedPrivacyMode().catch(() => {});
    const unsubscribe = PrivacyManager.subscribe((val) => {
      setIsPrivacyEnabled(val);
    });
    return unsubscribe;
  }, []);

  const togglePrivacyMode = useCallback(async () => {
    await PrivacyManager.togglePrivacyMode();
  }, []);

  const setPrivacyMode = useCallback(async (enabled: boolean) => {
    await PrivacyManager.setPrivacyEnabled(enabled);
  }, []);

  return (
    <PrivacyContext.Provider
      value={{
        isPrivacyEnabled,
        togglePrivacyMode,
        setPrivacyMode,
      }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacyMode(): PrivacyContextValue {
  return useContext(PrivacyContext);
}
