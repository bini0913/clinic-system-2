import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtETB, audit } from "@/lib/helpers";
import { toast } from "sonner";
import { Trash2, Plus, Send, Lock, ArrowUp, ArrowDown } from "lucide-react";

type Order = { id: string; type: "lab" | "treatment" | "pharmacy"; service_name: string; fee: number; service_id?: string };
type Rx = { id: string; medicine_name: string; dosage: string; frequency: string; duration: string; instructions: string };

export default function OPDVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [opd, setOpd] = useState<any>({ chief_complaint: "", history: "", examination: "", diagnosis: "", notes: "" });
  const [services, setServices] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [selSvc, setSelSvc] = useState<string>("");
  const [feeOverride, setFeeOverride] = useState<string>("");
  const [newRx, setNewRx] = useState({ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" });

  const load = async () => {
    const { data: v } = await supabase.from("visits")
      .select("*,patients(*),patient_cards(card_number)")
      .eq("id", id).single();
    setVisit(v);
    const { data: o } = await supabase.from("opd_records").select("*").eq("visit_id", id).maybeSingle();
    if (o) setOpd(o);
    const { data: s } = await supabase.from("service_catalogue").select("*").eq("is_active", true).order("category");
    setServices(s ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!visit) return <div>Loading…</div>;
  const locked = visit.status !== "opd_waiting" && visit.status !== "pending_payment";
  const opdLocked = !!opd.payment_locked;
  const isSubmitted = opd.status === "submitted" || visit.status === "pending_payment";

  const saveOPD = async () => {
    const payload = {
      visit_id: id, patient_id: visit.patient_id,
      chief_complaint: opd.chief_complaint, history: opd.history,
      examination: opd.examination, diagnosis: opd.diagnosis, notes: opd.notes,
    };
    const { data: existing } = await supabase.from("opd_records").select("id").eq("visit_id", id).maybeSingle();
    if (existing) await supabase.from("opd_records").update(payload).eq("id", existing.id);
    else await supabase.from("opd_records").insert({ ...payload, status: "draft", payment_locked: false });
    await audit("OPD_SAVED", "opd_records", id as string);
    toast.success("OPD record saved");
  };

  const addOrder = () => {
    if (!selSvc) return;
    const svc = services.find((s) => s.id === selSvc);
    if (!svc) return;
    if (!["lab", "treatment", "pharmacy"].includes(svc.category)) {
      toast.error("Only lab / treatment / pharmacy services can be ordered"); return;
    }
    const fee = feeOverride ? Number(feeOverride) : Number(svc.default_fee ?? 0);
    setOrders((prev) => [...prev, {
      id: crypto.randomUUID(),
      type: svc.category, service_name: svc.name, fee, service_id: svc.id,
    }]);
    setSelSvc(""); setFeeOverride("");
  };
  const move = (idx: number, dir: -1 | 1) => {
    setOrders((prev) => {
      const next = [...prev];
      const j = idx + dir; if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  };
  const removeOrder = (idx: number) => setOrders((prev) => prev.filter((_, i) => i !== idx));

  const addRx = () => {
    if (!newRx.medicine_name) return;
    setRx((prev) => [...prev, { id: crypto.randomUUID(), ...newRx }]);
    setNewRx({ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" });
  };
  const removeRx = (id: string) => setRx((prev) => prev.filter((r) => r.id !== id));

  const total = orders.reduce((s, o) => s + Number(o.fee || 0), 0);

  const submit = async () => {
    if (orders.length === 0 && rx.length === 0) {
      toast.error("Add at least one service or prescription"); return;
    }
    await saveOPD();

    const breakdown = orders.map((o) => ({ type: o.type, service_name: o.service_name, fee: Number(o.fee), service_id: o.service_id }));
    // Update opd_records: services_assigned, status
    await supabase.from("opd_records").update({
      services_assigned: breakdown,
      status: "submitted",
      updated_at: new Date().toISOString(),
    }).eq("visit_id", id);

    // Create prescriptions
    if (rx.length > 0) {
      await supabase.from("prescriptions").insert(rx.map((r) => ({
        visit_id: id, patient_id: visit.patient_id,
        medicine_name: r.medicine_name, dosage: r.dosage, frequency: r.frequency,
        duration: r.duration, instructions: r.instructions,
      })));
    }

    // Determine ordered sequence of unique service types (preserve doctor's order)
    const seqSet = new Set<string>();
    const sequence: string[] = [];
    orders.forEach((o) => { if (!seqSet.has(o.type)) { seqSet.add(o.type); sequence.push(o.type); } });
    if (rx.length > 0 && !seqSet.has("pharmacy")) sequence.push("pharmacy");

    // Create payment row for service fees (if any)
    if (total > 0) {
      await supabase.from("payments").insert({
        visit_id: id, patient_id: visit.patient_id,
        payment_type: "service_fee",
        services_breakdown: breakdown,
        total_amount: total,
        method: "cash",
        status: "pending",
      });
      await supabase.from("visits").update({
        status: "pending_payment",
        service_sequence: sequence,
        current_step_index: 0,
      }).eq("id", id);
    } else if (sequence.length > 0) {
      // No fees but services exist (e.g., pharmacy only with no service fee)
      await supabase.from("visits").update({
        status: `${sequence[0]}_waiting`,
        service_sequence: sequence,
        current_step_index: 0,
      }).eq("id", id);
    } else {
      await supabase.from("visits").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", id);
    }

    await audit("OPD_SUBMITTED", "visits", id as string, { total, sequence });
    toast.success("Submitted to reception");
    nav("/opd/queue");
  };

  return (
    <div>
      <PageHeader
        title={`${visit.token_number} · ${visit.patients?.full_name}`}
        subtitle={`Card ${visit.patient_cards?.card_number} · ${visit.patients?.phone} · ${visit.patients?.gender ?? "-"}`}
        action={
          <div className="flex gap-2 items-center">
            {(opdLocked || isSubmitted) && <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> {opdLocked ? "Payment locked" : "Submitted"}</Badge>}
            <Button onClick={submit} disabled={locked}><Send className="h-4 w-4" /> Submit to Reception</Button>
          </div>
        }
      />

      <Tabs defaultValue="opd" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opd">OPD Notes</TabsTrigger>
          <TabsTrigger value="orders">Lab/Treatment/Pharmacy</TabsTrigger>
          <TabsTrigger value="rx">Prescriptions</TabsTrigger>
        </TabsList>

        <TabsContent value="opd">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Chief complaint</Label>
                <Textarea rows={2} value={opd.chief_complaint || ""} onChange={(e) => setOpd({ ...opd, chief_complaint: e.target.value })} /></div>
              <div className="space-y-2"><Label>History</Label>
                <Textarea rows={2} value={opd.history || ""} onChange={(e) => setOpd({ ...opd, history: e.target.value })} /></div>
              <div className="space-y-2"><Label>Examination</Label>
                <Textarea rows={2} value={opd.examination || ""} onChange={(e) => setOpd({ ...opd, examination: e.target.value })} /></div>
              <div className="space-y-2"><Label>Diagnosis</Label>
                <Textarea rows={2} value={opd.diagnosis || ""} onChange={(e) => setOpd({ ...opd, diagnosis: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Notes / Plan</Label>
                <Textarea rows={3} value={opd.notes || ""} onChange={(e) => setOpd({ ...opd, notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end"><Button onClick={saveOPD}>Save OPD Notes</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardHeader><CardTitle>Assign services (order = sequence)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2 items-end">
                <div className="flex-1 min-w-[240px] space-y-2">
                  <Label>Service</Label>
                  <Select value={selSvc} onValueChange={setSelSvc}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          [{s.category}] {s.name} – {fmtETB(s.default_fee)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36 space-y-2">
                  <Label>Override fee</Label>
                  <Input type="number" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="optional" />
                </div>
                <Button onClick={addOrder} disabled={isSubmitted}><Plus className="h-4 w-4" /> Add</Button>
              </div>

              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Service</TableHead><TableHead>Type</TableHead>
                  <TableHead className="text-right">Fee</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {orders.map((o, i) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">{i + 1}</TableCell>
                      <TableCell>{o.service_name}</TableCell>
                      <TableCell><Badge variant="secondary">{o.type}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Input type="number" defaultValue={o.fee} className="h-8 w-28 text-right ml-auto"
                          disabled={isSubmitted}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, fee: v } : x));
                          }} />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => removeOrder(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No services assigned</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="flex justify-end text-sm">
                <div><span className="text-muted-foreground">Total: </span><b>{fmtETB(total)}</b></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rx">
          <Card><CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-5 gap-2 items-end">
                <div className="space-y-1"><Label>Medicine</Label><Input value={newRx.medicine_name} onChange={(e) => setNewRx({ ...newRx, medicine_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Dosage</Label><Input value={newRx.dosage} onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })} /></div>
                <div className="space-y-1"><Label>Frequency</Label><Input value={newRx.frequency} onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })} /></div>
                <div className="space-y-1"><Label>Duration</Label><Input value={newRx.duration} onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })} /></div>
                <Button onClick={addRx} disabled={isSubmitted}><Plus className="h-4 w-4" /> Add</Button>
              </div>
              <Textarea placeholder="Instructions (applies to next added)" value={newRx.instructions} onChange={(e) => setNewRx({ ...newRx, instructions: e.target.value })} />
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Medicine</TableHead><TableHead>Dosage</TableHead>
                  <TableHead>Frequency</TableHead><TableHead>Duration</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rx.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.medicine_name}</TableCell>
                      <TableCell>{r.dosage}</TableCell><TableCell>{r.frequency}</TableCell>
                      <TableCell>{r.duration}</TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => removeRx(r.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rx.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No prescriptions</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
