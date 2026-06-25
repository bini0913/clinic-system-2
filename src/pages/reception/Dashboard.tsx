import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Users, ListOrdered, CreditCard, Clock, UserPlus } from "lucide-react";
import { fmtETB } from "@/lib/helpers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const WAITING = ["opd_waiting", "lab_waiting", "treatment_waiting", "pharmacy_waiting", "pending_payment"];

export default function ReceptionDashboard() {
  const [stats, setStats] = useState({ today: 0, waiting: 0, revenue: 0, pending: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const [{ count: today }, { data: waiting }, { data: pays }, { data: pending }] = await Promise.all([
      supabase.from("visits").select("id", { count: "exact", head: true }).gte("created_at", start.toISOString()),
      supabase.from("visits").select("id").in("status", WAITING),
      supabase.from("payments").select("total_amount").gte("paid_at", start.toISOString()).eq("status", "paid"),
      supabase.from("payments").select("id").eq("status", "pending"),
    ]);
    setStats({
      today: today ?? 0,
      waiting: waiting?.length ?? 0,
      revenue: (pays ?? []).reduce((s, p: any) => s + Number(p.total_amount || 0), 0),
      pending: pending?.length ?? 0,
    });
    const { data: rec } = await supabase
      .from("visits")
      .select("id,token_number,status,created_at,patients(full_name,phone)")
      .order("created_at", { ascending: false }).limit(10);
    setRecent(rec ?? []);
  };
  useEffect(() => { load(); }, []);
  useRealtime(["visits", "payments"], load);

  return (
    <div>
      <PageHeader title="Reception Dashboard" subtitle="Today's overview & quick actions"
        action={<Button asChild><Link to="/reception/register"><UserPlus className="h-4 w-4" /> Register Patient</Link></Button>} />
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Patients Today" value={stats.today} icon={Users} tone="primary" />
        <StatCard label="In Queue" value={stats.waiting} icon={ListOrdered} tone="warning" />
        <StatCard label="Revenue Today" value={fmtETB(stats.revenue)} icon={CreditCard} tone="success" />
        <StatCard label="Pending Payments" value={stats.pending} icon={Clock} tone="destructive" />
      </div>
      <Card>
        <CardHeader><CardTitle>Recent Registrations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Token</TableHead><TableHead>Patient</TableHead><TableHead>Phone</TableHead><TableHead>Status</TableHead><TableHead>Time</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {recent.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono">{v.token_number}</TableCell>
                  <TableCell>{v.patients?.full_name}</TableCell>
                  <TableCell>{v.patients?.phone}</TableCell>
                  <TableCell><Badge variant="secondary">{v.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(v.created_at).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
              {recent.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No visits yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
