import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { setActiveCurrency, setActiveDateFormat } from "./utils";

export interface UserSettings {
  id: number;
  user_id: number;
  currency: string;
  date_format: string;
  budget_alerts: boolean;
  milestone_alerts: boolean;
  weekly_summary: boolean;
  recurring_budgets: boolean;
  rollover_budget: boolean;
  created_at: string;
  updated_at: string;
}

interface SettingsContextValue {
  settings: UserSettings | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
  updateSettings: (patch: Partial<Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at">>) => Promise<UserSettings>;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const SettingsContext = createContext<SettingsContextValue>({
  settings: null,
  isLoading: true,
  refetch: async () => {},
  updateSettings: async () => { throw new Error("SettingsContext not initialised"); },
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/settings`, { credentials: "include" });
      if (!res.ok) {
        // User not authenticated yet — silently skip
        setIsLoading(false);
        return;
      }
      const data: UserSettings = await res.json();
      setSettings(data);
      // Push into module-level vars so all formatCurrency / formatDate calls
      // automatically use the user's preferred values without prop-threading.
      setActiveCurrency(data.currency);
      setActiveDateFormat(data.date_format);
    } catch {
      // Network error — don't crash the app
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(async (
    patch: Partial<Omit<UserSettings, "id" | "user_id" | "created_at" | "updated_at">>
  ): Promise<UserSettings> => {
    const res = await fetch(`${BASE}/api/settings`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Failed to save settings");
    }
    const updated: UserSettings = await res.json();
    setSettings(updated);
    // Keep module-level vars in sync
    setActiveCurrency(updated.currency);
    setActiveDateFormat(updated.date_format);
    return updated;
  }, []);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    await fetchSettings();
  }, [fetchSettings]);

  return (
    <SettingsContext.Provider value={{ settings, isLoading, refetch, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
