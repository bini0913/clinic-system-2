import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PatientLink from "@/components/PatientLink";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { fmtDateTime } from "@/lib/helpers";
import type { Department } from "@/lib/activity";

export default function ActivityPage({ department, title }: { department: Department; title: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("patient_activity_log")
      .select("*,patients(full_name),visits(token_number),users(full_name,email)")
      .eq("department", department)
      .order("created_at", { ascending: false }).limit(500);
    if (from) query = query.gte("created_at", new Date(from).toISOString());
    if (to) { const t = new Date(to); t.setHours(23, 59, 59); query = query.lte("created_at", t.toISOString()); }
    const { data } = await query;
    let out = data ?? [];
    if (q.trim()) out = out.filter((r: any) => (r.patients?.full_name || "").toLowerCase().includes(q.toLowerCase()));
    setRows(out);
  };

  useEffect(() => { load(); }, [department, from, to, q]);

  return (
    <div>
      <PageHeader title={title} subtitle={`All ${department} activity across patients`} />
      <Card className="mb-4"><CardContent className="p-4 flex flex-wrap gap-3 items-end">
        <div className="space-y-1"><label className="text-xs">From</label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><label className="text-xs">To</label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="space-y-1 flex-1 min-w-48"><label className="text-xs">Search patient</label><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name…" /></div>
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>When</TableHead><TableHead>Patient</TableHead><TableHead>Token</TableHead>
            <TableHead>Action</TableHead><TableHead>By</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                <TableCell><PatientLink id={r.patient_id} name={r.patients?.full_name} /></TableCell>
                <TableCell className="font-mono text-xs">{r.visits?.token_number || "-"}</TableCell>
                <TableCell>{r.action}</TableCell>
                <TableCell className="text-xs">{r.users?.full_name || "-"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No activity</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
