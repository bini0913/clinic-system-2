import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtETB, fmtDateTime } from "@/lib/helpers";

type DateRange = "today" | "7d" | "30d" | "all";

function startOf(range: DateRange): Date | null {
  const d = new Date();
  if (range === "today") { d.setHours(0, 0, 0, 0); return d; }
  if (range === "7d") { d.setDate(d.getDate() - 7); return d; }
  if (range === "30d") { d.setDate(d.getDate() - 30); return d; }
  return null;
}

export default function AdminPayments() {
  const [rows, setRows] = useState<any[]>([]);
  const [users, setUsers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"all" | "pending" | "paid">("all");
  const [range, setRange] = useState<DateRange>("today");

  const load = async () => {
    let q = supabase.from("payments")
      .select("*,visits(token_number,patients(full_name,phone))")
      .eq("payment_type", "service_fee")
      .order("created_at", { ascending: false })
      .limit(500);
    if (status !== "all") q = q.eq("status", status);
    const from = startOf(range);
    if (from) q = q.gte("created_at", from.toISOString());
    const { data } = await q;
    setRows(data ?? []);

    const ids = Array.from(new Set((data ?? []).map((r: any) => r.received_by).filter(Boolean)));
    if (ids.length) {
      const { data: us } = await supabase.from("users").select("id,full_name").in("id", ids);
      const m: Record<string, string> = {};
      (us ?? []).forEach((u: any) => { m[u.id] = u.full_name; });
      setUsers(m);
    } else {
      setUsers({});
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status, range]);
  useRealtime(["payments", "visits"], load);

  const summary = useMemo(() => {
    const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
    const startMonth = new Date(); startMonth.setDate(1); startMonth.setHours(0, 0, 0, 0);
    let today = 0, month = 0, pending = 0;
    rows.forEach((p) => {
      const ts = new Date(p.paid_at || p.created_at);
      if (p.status === "paid") {
        if (ts >= startToday) today += Number(p.total_amount || 0);
        if (ts >= startMonth) month += Number(p.total_amount || 0);
      } else if (p.status === "pending") {
        pending += Number(p.total_amount || 0);
      }
    });
    return { today, month, pending, count: rows.length };
  }, [rows]);

  return (
    <div>
      <PageHeader title="Payments Overview" subtitle="All clinic payments — read-only admin view"
        action={
          <div className="flex gap-2">
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={range} onValueChange={(v) => setRange(v as DateRange)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        } />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Collected today</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{fmtETB(summary.today)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Collected this month</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{fmtETB(summary.month)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Pending</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{fmtETB(summary.pending)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">Transactions</CardTitle></CardHeader>
          <CardContent className="text-xl font-semibold">{summary.count}</CardContent></Card>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Token</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Bank / Ref</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Received by</TableHead>
            <TableHead>When</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((p) => {
              const items: any[] = Array.isArray(p.services_breakdown) ? p.services_breakdown : [];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.visits?.token_number}</TableCell>
                  <TableCell>
                    <a href={`/patient/${p.patient_id}`} className="text-sky-600 hover:underline font-medium">
                      {p.visits?.patients?.full_name || "—"}
                    </a>
                  </TableCell>
                  <TableCell className="text-xs">
                    {items.map((it, i) => (
                      <div key={i}>
                        {it.service_name || it.name} <span className="text-muted-foreground">({it.type})</span> · {fmtETB(it.fee)}
                      </div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmtETB(p.total_amount)}</TableCell>
                  <TableCell className="capitalize text-xs">{p.method || "—"}</TableCell>
                  <TableCell className="text-xs">
                    {p.bank_name ? (
                      <>
                        <div className="font-medium">{p.bank_name}</div>
                        {p.transfer_ref && <div className="text-muted-foreground">{p.transfer_ref}</div>}
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{p.received_by ? (users[p.received_by] || "—") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(p.paid_at || p.created_at)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
