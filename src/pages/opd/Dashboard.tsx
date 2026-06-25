import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Users, Clock, CheckCircle2, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function OPDDashboard() {
  const [s, setS] = useState({ waiting: 0, done: 0, total: 0 });
  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("visits").select("status").gte("created_at", start.toISOString());
    const c = (k: string) => (data ?? []).filter((d: any) => d.status === k).length;
    setS({
      waiting: c("opd_waiting"),
      done: (data ?? []).filter((d: any) => d.status !== "opd_waiting").length,
      total: data?.length ?? 0,
    });
  };
  useEffect(() => { load(); }, []);
  useRealtime(["visits"], load);

  return (
    <div>
      <PageHeader title="OPD Dashboard" subtitle="Doctor consultation overview"
        action={<Button asChild><Link to="/opd/queue"><Stethoscope className="h-4 w-4" /> Open Queue</Link></Button>} />
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Waiting for OPD" value={s.waiting} icon={Clock} tone="warning" />
        <StatCard label="Sent Forward" value={s.done} icon={CheckCircle2} tone="success" />
        <StatCard label="Total Today" value={s.total} icon={Users} tone="muted" />
      </div>
    </div>
  );
}
