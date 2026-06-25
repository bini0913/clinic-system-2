import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PatientBanner from "@/components/PatientBanner";
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
import { fmtETB, fmtDate, audit } from "@/lib/helpers";
import { toast } from "sonner";
import { Trash2, Plus, Send, Lock, ArrowUp, ArrowDown } from "lucide-react";

type Order = { id: string; type: "lab" | "treatment" | "pharmacy"; service_name: string; fee: number; service_id?: string; clinical_indication?: string };
type Rx = { id: string; medicine_name: string; dosage: string; route: string; frequency: string; duration: string; quantity: string; instructions: string };

const emptyVitals = { temp: "", bp_systolic: "", bp_diastolic: "", heart_rate: "", respiratory_rate: "", spo2: "", weight: "", height: "", bmi: "" };
const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "Sublingual", "Rectal"];

export default function OPDVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [opd, setOpd] = useState<any>({
    chief_complaint: "", history: "", past_medical_history: "", family_history: "",
    social_history: "", review_of_systems: "", examination: "", diagnosis: "",
    secondary_diagnosis: "", notes: "", follow_up_date: "", referral_notes: "",
  });
  const [vitals, setVitals] = useState<any>({ ...emptyVitals });
  const [services, setServices] = useState<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [rx, setRx] = useState<Rx[]>([]);
  const [selSvc, setSelSvc] = useState<string>("");
  const [feeOverride, setFeeOverride] = useState<string>("");
  const [orderIndication, setOrderIndication] = useState("");
  const [newRx, setNewRx] = useState<Rx>({ id: "", medicine_name: "", dosage: "", route: "Oral", frequency: "", duration: "", quantity: "", instructions: "" });
  const [history, setHistory] = useState<any[]>([]);

  // auto BMI
  useEffect(() => {
    const w = Number(vitals.weight), h = Number(vitals.height);
    if (w > 0 && h > 0) {
      const bmi = (w / Math.pow(h / 100, 2)).toFixed(1);
      if (bmi !== vitals.bmi) setVitals((v: any) => ({ ...v, bmi }));
    }
  }, [vitals.weight, vitals.height]);

  const load = async () => {
    const { data: v } = await supabase.from("visits")
      .select("*,patients(*),patient_cards(card_number)").eq("id", id).single();
    setVisit(v);
    const { data: o } = await supabase.from("opd_records").select("*").eq("visit_id", id).maybeSingle();
    if (o) {
      setOpd({
        chief_complaint: o.chief_complaint || "", history: o.history || "",
        past_medical_history: o.past_medical_history || "", family_history: o.family_history || "",
        social_history: o.social_history || "", review_of_systems: o.review_of_systems || "",
        examination: o.examination || "", diagnosis: o.diagnosis || "",
        secondary_diagnosis: o.secondary_diagnosis || "", notes: o.notes || "",
        follow_up_date: o.follow_up_date ? String(o.follow_up_date).slice(0, 10) : "",
        referral_notes: o.referral_notes || "",
        ...o,
      });
      if (o.vital_signs) setVitals({ ...emptyVitals, ...o.vital_signs });
    }
    const { data: s } = await supabase.from("service_catalogue").select("*").eq("is_active", true).order("category");
    setServices(s ?? []);
    if (v?.patient_id) {
      const { data: hist } = await supabase.from("visits")
        .select("id, token_number, created_at, status, opd_records(diagnosis,notes,services_assigned), payments(total_amount,status), lab_results(test_name,result), treatment_records(procedure), prescriptions(medicine_name,dosage)")
        .eq("patient_id", v.patient_id).neq("id", id).order("created_at", { ascending: false }).limit(10);
      setHistory(hist ?? []);
    }
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
      past_medical_history: opd.past_medical_history, family_history: opd.family_history,
      social_history: opd.social_history, review_of_systems: opd.review_of_systems,
      examination: opd.examination, diagnosis: opd.diagnosis,
      secondary_diagnosis: opd.secondary_diagnosis, notes: opd.notes,
      follow_up_date: opd.follow_up_date || null,
      referral_notes: opd.referral_notes,
      vital_signs: vitals,
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
    if (!svc || !["lab", "treatment", "pharmacy"].includes(svc.category)) {
      toast.error("Only lab / treatment / pharmacy services"); return;
    }
    const fee = feeOverride ? Number(feeOverride) : Number(svc.default_fee ?? 0);
    setOrders((prev) => [...prev, {
      id: crypto.randomUUID(), type: svc.category, service_name: svc.name, fee,
      service_id: svc.id, clinical_indication: orderIndication || undefined,
    }]);
    setSelSvc(""); setFeeOverride(""); setOrderIndication("");
  };
  const move = (idx: number, dir: -1 | 1) => setOrders((prev) => {
    const next = [...prev]; const j = idx + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[idx], next[j]] = [next[j], next[idx]]; return next;
  });
  const removeOrder = (idx: number) => setOrders((prev) => prev.filter((_, i) => i !== idx));

  const addRx = () => {
    if (!newRx.medicine_name) return;
    setRx((prev) => [...prev, { ...newRx, id: crypto.randomUUID() }]);
    setNewRx({ id: "", medicine_name: "", dosage: "", route: "Oral", frequency: "", duration: "", quantity: "", instructions: "" });
  };
  const removeRx = (rid: string) => setRx((prev) => prev.filter((r) => r.id !== rid));

  const total = orders.reduce((s, o) => s + Number(o.fee || 0), 0);

  const submit = async () => {
    if (orders.length === 0 && rx.length === 0) { toast.error("Add at least one service or prescription"); return; }
    await saveOPD();
    const breakdown = orders.map((o) => ({ type: o.type, service_name: o.service_name, fee: Number(o.fee), service_id: o.service_id, clinical_indication: o.clinical_indication }));
    await supabase.from("opd_records").update({ services_assigned: breakdown, status: "submitted", updated_at: new Date().toISOString() }).eq("visit_id", id);

    if (rx.length > 0) {
      await supabase.from("prescriptions").insert(rx.map((r) => ({
        visit_id: id, patient_id: visit.patient_id,
        medicine_name: r.medicine_name, dosage: r.dosage, route: r.route,
        frequency: r.frequency, duration: r.duration,
        quantity: r.quantity ? Number(r.quantity) : null,
        instructions: r.instructions,
      })));
    }

    const seqSet = new Set<string>(); const sequence: string[] = [];
    orders.forEach((o) => { if (!seqSet.has(o.type)) { seqSet.add(o.type); sequence.push(o.type); } });
    if (rx.length > 0 && !seqSet.has("pharmacy")) sequence.push("pharmacy");

    if (total > 0) {
      await supabase.from("payments").insert({
        visit_id: id, patient_id: visit.patient_id, payment_type: "service_fee",
        services_breakdown: breakdown, total_amount: total, method: "cash", status: "pending",
      });
      await supabase.from("visits").update({ status: "pending_payment", service_sequence: sequence, current_step_index: 0 }).eq("id", id);
    } else if (sequence.length > 0) {
      await supabase.from("visits").update({ status: `${sequence[0]}_waiting`, service_sequence: sequence, current_step_index: 0 }).eq("id", id);
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
        subtitle={`Card ${visit.patient_cards?.card_number}`}
        action={
          <div className="flex gap-2 items-center">
            {(opdLocked || isSubmitted) && <Badge variant="secondary"><Lock className="h-3 w-3 mr-1" /> {opdLocked ? "Payment locked" : "Submitted"}</Badge>}
            <Button onClick={submit} disabled={locked}><Send className="h-4 w-4" /> Submit to Reception</Button>
          </div>
        }
      />

      <PatientBanner patient={visit.patients} token={visit.token_number} vitals={vitals} />

      <Tabs defaultValue="opd" className="space-y-4">
        <TabsList>
          <TabsTrigger value="opd">Clinical Notes</TabsTrigger>
          <TabsTrigger value="vitals">Vital Signs</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="rx">Prescriptions</TabsTrigger>
          <TabsTrigger value="history">Patient History</TabsTrigger>
        </TabsList>

        <TabsContent value="opd">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2"><Label>Chief complaint *</Label>
                <Textarea rows={2} value={opd.chief_complaint} onChange={(e) => setOpd({ ...opd, chief_complaint: e.target.value })} /></div>
              <div className="space-y-2"><Label>History of present illness</Label>
                <Textarea rows={3} value={opd.history} onChange={(e) => setOpd({ ...opd, history: e.target.value })} /></div>
              <div className="space-y-2"><Label>Past medical history</Label>
                <Textarea rows={3} value={opd.past_medical_history} onChange={(e) => setOpd({ ...opd, past_medical_history: e.target.value })} /></div>
              <div className="space-y-2"><Label>Family history</Label>
                <Textarea rows={2} value={opd.family_history} onChange={(e) => setOpd({ ...opd, family_history: e.target.value })} /></div>
              <div className="space-y-2"><Label>Social history (smoking, alcohol, etc.)</Label>
                <Textarea rows={2} value={opd.social_history} onChange={(e) => setOpd({ ...opd, social_history: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Review of systems</Label>
                <Textarea rows={2} value={opd.review_of_systems} onChange={(e) => setOpd({ ...opd, review_of_systems: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Physical examination findings</Label>
                <Textarea rows={3} value={opd.examination} onChange={(e) => setOpd({ ...opd, examination: e.target.value })} /></div>
              <div className="space-y-2"><Label>Primary diagnosis</Label>
                <Textarea rows={2} value={opd.diagnosis} onChange={(e) => setOpd({ ...opd, diagnosis: e.target.value })} /></div>
              <div className="space-y-2"><Label>Secondary diagnosis</Label>
                <Textarea rows={2} value={opd.secondary_diagnosis} onChange={(e) => setOpd({ ...opd, secondary_diagnosis: e.target.value })} /></div>
              <div className="space-y-2 md:col-span-2"><Label>Clinical notes / plan</Label>
                <Textarea rows={3} value={opd.notes} onChange={(e) => setOpd({ ...opd, notes: e.target.value })} /></div>
              <div className="space-y-2"><Label>Follow-up date</Label>
                <Input type="date" value={opd.follow_up_date} onChange={(e) => setOpd({ ...opd, follow_up_date: e.target.value })} /></div>
              <div className="space-y-2"><Label>Referral notes</Label>
                <Textarea rows={2} value={opd.referral_notes} onChange={(e) => setOpd({ ...opd, referral_notes: e.target.value })} /></div>
            </div>
            <div className="flex justify-end"><Button onClick={saveOPD}>Save Clinical Notes</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="vitals">
          <Card><CardContent className="p-6 space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div className="space-y-1"><Label>Temperature (°C)</Label>
                <Input type="number" step="0.1" value={vitals.temp} onChange={(e) => setVitals({ ...vitals, temp: e.target.value })} /></div>
              <div className="space-y-1"><Label>BP systolic (mmHg)</Label>
                <Input type="number" value={vitals.bp_systolic} onChange={(e) => setVitals({ ...vitals, bp_systolic: e.target.value })} /></div>
              <div className="space-y-1"><Label>BP diastolic (mmHg)</Label>
                <Input type="number" value={vitals.bp_diastolic} onChange={(e) => setVitals({ ...vitals, bp_diastolic: e.target.value })} /></div>
              <div className="space-y-1"><Label>Heart rate (bpm)</Label>
                <Input type="number" value={vitals.heart_rate} onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })} /></div>
              <div className="space-y-1"><Label>Respiratory rate</Label>
                <Input type="number" value={vitals.respiratory_rate} onChange={(e) => setVitals({ ...vitals, respiratory_rate: e.target.value })} /></div>
              <div className="space-y-1"><Label>SpO₂ (%)</Label>
                <Input type="number" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} /></div>
              <div className="space-y-1"><Label>Weight (kg)</Label>
                <Input type="number" step="0.1" value={vitals.weight} onChange={(e) => setVitals({ ...vitals, weight: e.target.value })} /></div>
              <div className="space-y-1"><Label>Height (cm)</Label>
                <Input type="number" step="0.1" value={vitals.height} onChange={(e) => setVitals({ ...vitals, height: e.target.value })} /></div>
              <div className="space-y-1"><Label>BMI (auto)</Label>
                <Input value={vitals.bmi} readOnly className="bg-muted" /></div>
            </div>
            <div className="flex justify-end"><Button onClick={saveOPD}>Save Vitals</Button></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card><CardHeader><CardTitle>Assign services (order = sequence)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-4 gap-2 items-end">
                <div className="md:col-span-2 space-y-2">
                  <Label>Service</Label>
                  <Select value={selSvc} onValueChange={setSelSvc}>
                    <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                    <SelectContent>
                      {services.map((s) => (
                        <SelectItem key={s.id} value={s.id}>[{s.category}] {s.name} – {fmtETB(s.default_fee)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Override fee</Label>
                  <Input type="number" value={feeOverride} onChange={(e) => setFeeOverride(e.target.value)} placeholder="optional" /></div>
                <Button onClick={addOrder} disabled={isSubmitted}><Plus className="h-4 w-4" /> Add</Button>
                <div className="md:col-span-4 space-y-2"><Label>Clinical indication (optional)</Label>
                  <Input value={orderIndication} onChange={(e) => setOrderIndication(e.target.value)} placeholder="e.g. r/o anemia" /></div>
              </div>

              <Table>
                <TableHeader><TableRow>
                  <TableHead>#</TableHead><TableHead>Service</TableHead><TableHead>Type</TableHead>
                  <TableHead>Indication</TableHead><TableHead className="text-right">Fee</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {orders.map((o, i) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono">{i + 1}</TableCell>
                      <TableCell>{o.service_name}</TableCell>
                      <TableCell><Badge variant="secondary">{o.type}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{o.clinical_indication || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Input type="number" defaultValue={o.fee} className="h-8 w-28 text-right ml-auto" disabled={isSubmitted}
                          onBlur={(e) => { const v = Number(e.target.value); setOrders((prev) => prev.map((x) => x.id === o.id ? { ...x, fee: v } : x)); }} />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => removeOrder(i)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {orders.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No services assigned</TableCell></TableRow>}
                </TableBody>
              </Table>
              <div className="flex justify-end text-sm"><div><span className="text-muted-foreground">Total: </span><b>{fmtETB(total)}</b></div></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rx">
          <Card><CardHeader><CardTitle>Prescriptions</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-7 gap-2 items-end">
                <div className="space-y-1 md:col-span-2"><Label>Medicine</Label><Input value={newRx.medicine_name} onChange={(e) => setNewRx({ ...newRx, medicine_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Dosage</Label><Input value={newRx.dosage} onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })} /></div>
                <div className="space-y-1"><Label>Route</Label>
                  <Select value={newRx.route} onValueChange={(v) => setNewRx({ ...newRx, route: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Frequency</Label><Input value={newRx.frequency} onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })} /></div>
                <div className="space-y-1"><Label>Duration</Label><Input value={newRx.duration} onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })} /></div>
                <div className="space-y-1"><Label>Qty</Label><Input type="number" value={newRx.quantity} onChange={(e) => setNewRx({ ...newRx, quantity: e.target.value })} /></div>
              </div>
              <div className="flex gap-2">
                <Textarea className="flex-1" placeholder="Instructions (for next added)" value={newRx.instructions} onChange={(e) => setNewRx({ ...newRx, instructions: e.target.value })} />
                <Button onClick={addRx} disabled={isSubmitted}><Plus className="h-4 w-4" /> Add</Button>
              </div>

              <div className="border rounded-md p-4 bg-muted/30">
                <div className="text-xs font-semibold uppercase text-muted-foreground mb-2">Prescription preview</div>
                {rx.length === 0 && <div className="text-sm text-muted-foreground">Nothing prescribed yet.</div>}
                <ol className="space-y-2 text-sm list-decimal pl-5">
                  {rx.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3">
                      <div>
                        <b>{r.medicine_name}</b> {r.dosage && <span className="text-muted-foreground">— {r.dosage}</span>}
                        {r.route && <span className="text-muted-foreground"> · {r.route}</span>}
                        {r.frequency && <span className="text-muted-foreground"> · {r.frequency}</span>}
                        {r.duration && <span className="text-muted-foreground"> · {r.duration}</span>}
                        {r.quantity && <span className="text-muted-foreground"> · qty {r.quantity}</span>}
                        {r.instructions && <div className="text-xs text-muted-foreground italic">{r.instructions}</div>}
                      </div>
                      <Button size="icon" variant="ghost" disabled={isSubmitted} onClick={() => removeRx(r.id)}><Trash2 className="h-4 w-4" /></Button>
                    </li>
                  ))}
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card><CardHeader><CardTitle>Previous visits</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 && <div className="text-sm text-muted-foreground">No previous visits.</div>}
              {history.map((v: any) => {
                const paid = (v.payments || []).filter((p: any) => p.status === "paid")
                  .reduce((s: number, p: any) => s + Number(p.total_amount || 0), 0);
                const o = v.opd_records?.[0];
                return (
                  <details key={v.id} className="border rounded-md p-3">
                    <summary className="cursor-pointer text-sm flex flex-wrap gap-3 items-center">
                      <span className="font-mono">{v.token_number}</span>
                      <span>{fmtDate(v.created_at)}</span>
                      <Badge variant="outline">{v.status}</Badge>
                      {o?.diagnosis && <span className="truncate max-w-[300px]">Dx: {o.diagnosis}</span>}
                      <span className="ml-auto font-medium">{fmtETB(paid)}</span>
                    </summary>
                    <div className="text-xs space-y-2 mt-3 pl-2">
                      {o?.notes && <div><b>Notes:</b> {o.notes}</div>}
                      {o?.services_assigned?.length > 0 && (
                        <div><b>Services:</b> {o.services_assigned.map((s: any) => s.service_name).join(", ")}</div>
                      )}
                      {v.lab_results?.length > 0 && (
                        <div><b>Lab:</b> {v.lab_results.map((l: any) => `${l.test_name}=${l.result}`).join("; ")}</div>
                      )}
                      {v.treatment_records?.length > 0 && (
                        <div><b>Treatment:</b> {v.treatment_records.map((t: any) => t.procedure).join("; ")}</div>
                      )}
                      {v.prescriptions?.length > 0 && (
                        <div><b>Rx:</b> {v.prescriptions.map((p: any) => `${p.medicine_name} ${p.dosage}`).join("; ")}</div>
                      )}
                    </div>
                  </details>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
