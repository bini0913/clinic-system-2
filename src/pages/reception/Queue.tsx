import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/helpers";

const STATUS_TONE: Record<string, string> = {
  opd_waiting: "bg-sky-100 text-sky-700",
  pending_payment: "bg-rose-100 text-rose-700",
  lab_waiting: "bg-amber-100 text-amber-700",
  treatment_waiting: "bg-violet-100 text-violet-700",
  pharmacy_waiting: "bg-emerald-100 text-emerald-700",
  completed: "bg-slate-200 text-slate-700",
};

export default function Queue() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data } = await supabase.from("visits")
      .select("id,token_number,status,created_at,patients(full_name,phone)")
      .gte("created_at", start.toISOString())
      .order("created_at", { ascending: true });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  useRealtime(["visits"], load);

  return (
    <div>
      <PageHeader title="Live Queue" subtitle="All today's visits, updating in real time" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Token</TableHead><TableHead>Patient</TableHead><TableHead>Phone</TableHead>
            <TableHead>Status</TableHead><TableHead>Registered</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono font-medium">{v.token_number}</TableCell>
                <TableCell>{v.patients?.full_name}</TableCell>
                <TableCell>{v.patients?.phone}</TableCell>
                <TableCell><Badge className={STATUS_TONE[v.status] ?? ""} variant="secondary">{v.status}</Badge></TableCell>
                <TableCell className="text-muted-foreground text-xs">{fmtDateTime(v.created_at)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Queue empty</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
