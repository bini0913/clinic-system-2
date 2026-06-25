import { useEffect } from "react";
import { supabase } from "./supabase";

export function useRealtime(tables: string[], onChange: () => void) {
  useEffect(() => {
    const ch = supabase.channel("rt-" + tables.join("-"));
    tables.forEach((t) => ch.on("postgres_changes", { event: "*", schema: "public", table: t }, onChange));
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
