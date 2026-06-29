import { useEffect, useRef } from "react";
import { supabase } from "./supabase";

export function useRealtime(tables: string[], onChange: () => void) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  useEffect(() => {
    const channelName = "rt-" + tables.join("-") + "-" + Math.random().toString(36).slice(2);
    const ch = supabase.channel(channelName);
    tables.forEach((t) =>
      ch.on("postgres_changes" as any, { event: "*", schema: "public", table: t }, () => onChangeRef.current())
    );
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);
}
