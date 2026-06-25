import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "./supabase";

export interface ClinicSettings {
  clinic_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  receipt_footer?: string;
  card_fee?: number;
  banks?: string[];
  [k: string]: any;
}

interface Ctx { settings: ClinicSettings; refresh: () => Promise<void>; loading: boolean }
const SettingsCtx = createContext<Ctx>({ settings: {}, refresh: async () => {}, loading: true });
export const useSettings = () => useContext(SettingsCtx);

function parseValue(raw: any): any {
  if (raw == null) return raw;
  if (typeof raw !== "string") return raw;
  const t = raw.trim();
  if ((t.startsWith("[") && t.endsWith("]")) || (t.startsWith("{") && t.endsWith("}"))) {
    try { return JSON.parse(t); } catch { return raw; }
  }
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return raw;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ClinicSettings>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase.from("clinic_settings").select("*");
    const out: ClinicSettings = {};
    (data ?? []).forEach((row: any) => { out[row.key] = parseValue(row.value); });
    if (typeof out.banks === "string") {
      try { out.banks = JSON.parse(out.banks); } catch { out.banks = []; }
    }
    if (!Array.isArray(out.banks)) out.banks = [];
    setSettings(out);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return <SettingsCtx.Provider value={{ settings, refresh, loading }}>{children}</SettingsCtx.Provider>;
}
