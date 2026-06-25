import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { useSettings } from "@/lib/settings";
import { format } from "date-fns";

const ROOMS = [
  { key: "opd", label: "OPD Consultation", color: "from-sky-500 to-blue-600" },
  { key: "lab", label: "Laboratory", color: "from-amber-500 to-orange-600" },
  { key: "treatment", label: "Treatment Room", color: "from-violet-500 to-purple-600" },
  { key: "pharmacy", label: "Pharmacy", color: "from-emerald-500 to-teal-600" },
];

export default function Display() {
  const { settings } = useSettings();
  const [rows, setRows] = useState<any[]>([]);
  const [time, setTime] = useState(new Date());

  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("visits")
      .select("id,token_number,status")
      .gte("created_at", start.toISOString());
    setRows(data ?? []);
  };
  useEffect(() => {
    load();
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useRealtime(["visits"], load);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">{settings.clinic_name || "Clinic"} — Now Serving</h1>
          <p className="text-slate-400 mt-1">Live patient queue display</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-mono font-semibold">{format(time, "HH:mm:ss")}</div>
          <div className="text-slate-400">{format(time, "EEEE, MMM d, yyyy")}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {ROOMS.map((r) => {
          const waiting = rows.filter((v) => v.status === `${r.key}_waiting`);
          return (
            <div key={r.key} className="rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden flex flex-col">
              <div className={`bg-gradient-to-br ${r.color} p-5`}>
                <div className="text-sm uppercase tracking-wider opacity-90">{r.label}</div>
                <div className="text-5xl font-bold font-mono mt-3 min-h-[60px]">
                  {waiting[0]?.token_number ?? "—"}
                </div>
                <div className="text-sm opacity-90 mt-1">
                  Now serving
                </div>
              </div>
              <div className="p-4 flex-1">
                <div className="text-xs uppercase text-slate-400 mb-2">Up next</div>
                <div className="space-y-1">
                  {waiting.slice(1, 6).map((v) => (
                    <div key={v.id} className="flex items-center text-sm">
                      <span className="font-mono text-slate-200">{v.token_number}</span>
                    </div>
                  ))}
                  {waiting.length <= 1 && <div className="text-sm text-slate-600">No one else waiting</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-8 text-center text-slate-500 text-sm">
        Updating in real time · {rows.length} patients today
      </div>
    </div>
  );
}
