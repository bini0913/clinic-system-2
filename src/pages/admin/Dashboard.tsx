import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CreditCard, ListOrdered, Activity } from "lucide-react";
import { fmtETB } from "@/lib/helpers";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays } from "date-fns";

const COLORS = ["#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#EF4444", "#64748B"];
const WAITING = ["opd_waiting","lab_waiting","treatment_waiting","pharmacy_waiting","pending_payment"];

export default function AdminDashboard() {
  const [s, setS] = useState({ patients: 0, visits: 0, revenue: 0, inQueue: 0 });
  const [byDay, setByDay] = useState<any[]>([]);
  const [byType, setByType] = useState<any[]>([]);

  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [{ count: patients }, { count: visits }, { data: pays }, { data: inQ }] = await Promise.all([
      supabase.from("patients").select("id", { count: "exact", head: true }),
      supabase.from("visits").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
      supabase.from("payments").select("total_amount,payment_type,paid_at,status").eq("status", "paid"),
      supabase.from("visits").select("id").in("status", WAITING),
    ]);
    const todayRevenue = (pays ?? []).filter((p: any) => p.paid_at && new Date(p.paid_at) >= start).reduce((a: number, p: any) => a + Number(p.total_amount), 0);
    setS({ patients: patients ?? 0, visits: visits ?? 0, revenue: todayRevenue, inQueue: inQ?.length ?? 0 });

    const days = Array.from({ length: 7 }).map((_, i) => {
      const d = subDays(new Date(), 6 - i);
      const k = format(d, "MMM d");
      const total = (pays ?? []).filter((p: any) => p.paid_at && format(new Date(p.paid_at), "MMM d") === k).reduce((a: number, p: any) => a + Number(p.total_amount), 0);
      return { day: k, revenue: total };
    });
    setByDay(days);

    const map: Record<string, number> = {};
    (pays ?? []).forEach((p: any) => { map[p.payment_type || "other"] = (map[p.payment_type || "other"] || 0) + Number(p.total_amount); });
    setByType(Object.entries(map).map(([name, value]) => ({ name, value })));
  };
  useEffect(() => { load(); }, []);
  useRealtime(["payments", "visits"], load);

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Clinic-wide performance" />
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Total Patients" value={s.patients} icon={Users} tone="primary" />
        <StatCard label="Visits Today" value={s.visits} icon={Activity} tone="success" />
        <StatCard label="Revenue Today" value={fmtETB(s.revenue)} icon={CreditCard} tone="warning" />
        <StatCard label="Currently in Queue" value={s.inQueue} icon={ListOrdered} tone="muted" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Revenue – Last 7 days</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={byDay}>
              <XAxis dataKey="day" /><YAxis />
              <Tooltip formatter={(v) => fmtETB(Number(v))} />
              <Bar dataKey="revenue" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
            </BarChart></ResponsiveContainer>
          </CardContent></Card>
        <Card><CardHeader><CardTitle>Revenue by Payment Type</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" outerRadius={90} label>
                {byType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmtETB(Number(v))} /><Legend />
            </PieChart></ResponsiveContainer>
          </CardContent></Card>
      </div>
    </div>
  );
}
