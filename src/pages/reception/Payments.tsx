import { useEffect, useState, useRef } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { fmtETB, fmtDateTime, audit, advance } from "@/lib/helpers";
import { logActivity, notify, type Department } from "@/lib/activity";
import { useReactToPrint } from "react-to-print";
import { toast } from "sonner";
import { Printer, CheckCircle2 } from "lucide-react";

export default function Payments() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const banks: string[] = (settings.banks as string[]) || [];

  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("pending");
  const [receipt, setReceipt] = useState<any>(null);
  const [paying, setPaying] = useState<any>(null);
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [bank, setBank] = useState("");
  const [ref, setRef] = useState("");
  const ref0 = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef: ref0 });

  const load = async () => {
    let q = supabase.from("payments")
      .select("*,visits(id,token_number,patient_id,service_sequence,current_step_index,patients(full_name,phone))")
      .eq("payment_type", "service_fee")
      .order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [filter]);
  useRealtime(["payments", "visits"], load);

  const openPay = (p: any) => {
    setPaying(p);
    setMethod("cash"); setBank(""); setRef("");
  };

  const confirmPay = async () => {
    if (!paying) return;
    if (method === "transfer" && (!bank || !ref.trim())) {
      toast.error("Bank and reference required"); return;
    }
    const { error } = await supabase.from("payments").update({
      method,
      bank_name: method === "transfer" ? bank : null,
      transfer_ref: method === "transfer" ? ref : null,
      status: "paid",
      received_by: user?.id ?? null,
      paid_at: new Date().toISOString(),
    }).eq("id", paying.id);
    if (error) { toast.error(error.message); return; }

    // Lock opd_records so doctor can no longer edit fees
    await supabase.from("opd_records").update({ payment_locked: true }).eq("visit_id", paying.visit_id);

    // Advance visit to first service in sequence (or complete)
    const { data: freshVisit } = await supabase.from("visits")
      .select("id,patient_id,service_sequence,current_step_index")
      .eq("id", paying.visits?.id ?? paying.visit_id)
      .single();
    if (freshVisit) {
      await advance({ ...freshVisit, current_step_index: -1 });
    }

    const patientName = paying.visits?.patients?.full_name || "patient";
    const token = paying.visits?.token_number || "";
    const seq: string[] = freshVisit?.service_sequence || [];
    const toRoles: Department[] = (seq as Department[]).filter((s) => ["laboratory", "treatment", "pharmacy"].includes(s === "lab" ? "laboratory" : s) ).map((s: any) => s === "lab" ? "laboratory" : s);

    await logActivity({
      patient_id: paying.patient_id, visit_id: paying.visit_id,
      department: "reception", action: `Payment collected — ${paying.total_amount} ETB (${method})`,
      details: { amount: paying.total_amount, method },
    });
    if (toRoles.length > 0) {
      await notify({
        to_role: toRoles, from_role: "reception",
        visit_id: paying.visit_id, patient_id: paying.patient_id,
        message: `Patient ${patientName} payment cleared — Token ${token}`,
      });
    }

    await audit("PAYMENT_COLLECTED", "payments", paying.id, { amount: paying.total_amount, method });
    toast.success("Payment confirmed");
    setReceipt({ ...paying, method, paid_at: new Date().toISOString() });
    setPaying(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Payments" subtitle="Confirm pending service payments and print receipts"
        action={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        } />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Token</TableHead><TableHead>Patient</TableHead><TableHead>Services</TableHead>
            <TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead>
            <TableHead>When</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((p) => {
              const items: any[] = Array.isArray(p.services_breakdown) ? p.services_breakdown : [];
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">{p.visits?.token_number}</TableCell>
                  <TableCell>{p.visits?.patients?.full_name}</TableCell>
                  <TableCell className="text-xs">
                    {items.map((it, i) => (
                      <div key={i}>{it.service_name || it.name} <span className="text-muted-foreground">({it.type})</span> · {fmtETB(it.fee)}</div>
                    ))}
                  </TableCell>
                  <TableCell className="text-right font-medium">{fmtETB(p.total_amount)}</TableCell>
                  <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtDateTime(p.paid_at || p.created_at)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {p.status === "pending" && (
                      <Button size="sm" onClick={() => openPay(p)}><CheckCircle2 className="h-4 w-4" /> Collect</Button>
                    )}
                    {p.status === "paid" && (
                      <Button size="sm" variant="outline" onClick={() => { setReceipt(p); setTimeout(print, 200); }}>
                        <Printer className="h-4 w-4" /> Receipt
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No payments</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!paying} onOpenChange={(o) => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Collect payment — {fmtETB(paying?.total_amount)}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="flex gap-4">
              <label className="flex items-center gap-2"><RadioGroupItem value="cash" /> Cash</label>
              <label className="flex items-center gap-2"><RadioGroupItem value="transfer" /> Bank Transfer</label>
            </RadioGroup>
            {method === "transfer" && (
              <>
                <div className="space-y-1"><Label>Bank</Label>
                  <Select value={bank} onValueChange={setBank}>
                    <SelectTrigger><SelectValue placeholder="Select bank…" /></SelectTrigger>
                    <SelectContent>
                      {banks.length === 0 && <SelectItem value="Other">Other</SelectItem>}
                      {banks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Reference</Label>
                  <Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
              </>
            )}
          </div>
          <DialogFooter><Button onClick={confirmPay}>Confirm Payment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Receipt</DialogTitle></DialogHeader>
          {receipt && (
            <div ref={ref0} className="p-6 text-sm">
              <div className="text-center mb-4">
                <div className="text-lg font-semibold">{settings.clinic_name || "Clinic"} — Receipt</div>
                <div className="text-xs text-muted-foreground">{fmtDateTime(receipt.paid_at || receipt.created_at)}</div>
              </div>
              <div className="space-y-1">
                <div><b>Token:</b> {receipt.visits?.token_number}</div>
                <div><b>Patient:</b> {receipt.visits?.patients?.full_name}</div>
                <div className="mt-2">
                  {(receipt.services_breakdown || []).map((it: any, i: number) => (
                    <div key={i} className="flex justify-between"><span>{it.service_name || it.name}</span><span>{fmtETB(it.fee)}</span></div>
                  ))}
                </div>
                <div className="mt-3 text-lg flex justify-between border-t pt-2"><b>Total</b> <b>{fmtETB(receipt.total_amount)}</b></div>
                <div className="text-xs text-muted-foreground">Method: {receipt.method}{receipt.bank_name ? ` · ${receipt.bank_name} · ${receipt.transfer_ref}` : ""}</div>
                {settings.receipt_footer && <div className="text-center text-xs text-muted-foreground mt-4">{settings.receipt_footer}</div>}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={print}><Printer className="h-4 w-4" /> Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
