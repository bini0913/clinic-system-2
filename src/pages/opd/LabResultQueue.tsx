import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PatientBanner from "@/components/PatientBanner";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { fmtDateTime, fmtETB, audit } from "@/lib/helpers";
import { logActivity, notify } from "@/lib/activity";
import { statusLabel, statusColor } from "@/lib/visitStatus";
import { toast } from "sonner";
import { Plus, Trash2, Eye, Send } from "lucide-react";

type Rx = { id: string; medicine_name: string; dosage: string; route: string; frequency: string; duration: string; quantity: string; instructions: string };
type TOrder = { id: string; procedure: string; notes: string };
const ROUTES = ["Oral", "IV", "IM", "SC", "Topical", "Inhaled", "Sublingual", "Rectal"];

export default function LabResultQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);

  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [decision, setDecision] = useState<"pharmacy" | "treatment" | "both" | "discharge">("discharge");

  const [rx, setRx] = useState<Rx[]>([]);
  const [newRx, setNewRx] = useState<Rx>({ id: "", medicine_name: "", dosage: "", route: "Oral", frequency: "", duration: "", quantity: "", instructions: "" });
  const [tOrders, setTOrders] = useState<TOrder[]>([]);
  const [newT, setNewT] = useState<TOrder>({ id: "", procedure: "", notes: "" });

  const load = async () => {
    const { data } = await supabase.from("visits")
      .select("id,token_number,status,created_at,patient_id,patients(full_name,phone),patient_cards(card_number),lab_results(test_name)")
      .eq("status", "lab_result_pending")
      .order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  useRealtime(["visits", "lab_results"], load);

  const openReview = async (visitId: string) => {
    setOpenId(visitId);
    const { data: v } = await supabase.from("visits")
      .select("*,patients(*),patient_cards(card_number),opd_records(*),lab_results(*)").eq("id", visitId).single();
    setDetail(v);
    const o = v?.opd_records?.[0];
    setDiagnosis(o?.diagnosis || "");
    setNotes(o?.notes || "");
    setFollowUp(o?.follow_up_date ? String(o.follow_up_date).slice(0, 10) : "");
    setDecision("discharge");
    setRx([]); setTOrders([]);
    const { data: s } = await supabase.from("service_catalogue").select("*").eq("is_active", true);
    setServices(s ?? []);
  };

  const close = () => { setOpenId(null); setDetail(null); };

  const addRx = () => {
    if (!newRx.medicine_name) return;
    setRx((p) => [...p, { ...newRx, id: crypto.randomUUID() }]);
    setNewRx({ id: "", medicine_name: "", dosage: "", route: "Oral", frequency: "", duration: "", quantity: "", instructions: "" });
  };
  const addTreatment = () => {
    if (!newT.procedure) return;
    setTOrders((p) => [...p, { ...newT, id: crypto.randomUUID() }]);
    setNewT({ id: "", procedure: "", notes: "" });
  };

  const confirmAndSend = async () => {
    if (!detail) return;
    const visitId = detail.id;
    const patientId = detail.patient_id;

    // Update OPD record with revised diagnosis/notes
    await supabase.from("opd_records").update({
      diagnosis, notes,
      follow_up_date: followUp || null,
      post_lab_review_at: new Date().toISOString(),
      post_lab_review_diagnosis: diagnosis,
      post_lab_review_notes: notes,
      updated_at: new Date().toISOString(),
    }).eq("visit_id", visitId);

    // Build new sequence based on decision
    const sequence: string[] = [];
    if (decision === "treatment" || decision === "both") sequence.push("treatment");
    if (decision === "pharmacy" || decision === "both" || rx.length > 0) {
      if (!sequence.includes("pharmacy")) sequence.push("pharmacy");
    }

    // Insert prescriptions
    if (rx.length > 0) {
      await supabase.from("prescriptions").insert(rx.map((r) => ({
        visit_id: visitId, patient_id: patientId,
        medicine_name: r.medicine_name, dosage: r.dosage, route: r.route,
        frequency: r.frequency, duration: r.duration,
        quantity: r.quantity ? Number(r.quantity) : null,
        instructions: r.instructions,
      })));
    }

    // Append treatment orders to opd_records.services_assigned for the treatment room to see
    if (tOrders.length > 0) {
      const existing = (detail.opd_records?.[0]?.services_assigned || []) as any[];
      const merged = [...existing, ...tOrders.map((t) => ({
        type: "treatment", service_name: t.procedure, clinical_indication: t.notes, fee: 0, post_lab: true,
      }))];
      await supabase.from("opd_records").update({ services_assigned: merged }).eq("visit_id", visitId);
    }

    if (sequence.length === 0) {
      await supabase.from("visits").update({
        status: "completed", completed_at: new Date().toISOString(),
        service_sequence: [], current_step_index: 0,
      }).eq("id", visitId);
      await logActivity({ patient_id: patientId, visit_id: visitId, department: "opd", action: "Post-lab review — discharged", details: { diagnosis } });
    } else {
      await supabase.from("visits").update({
        status: `${sequence[0]}_waiting`,
        service_sequence: sequence,
        current_step_index: 0,
      }).eq("id", visitId);
      await logActivity({ patient_id: patientId, visit_id: visitId, department: "opd", action: `Post-lab review — sent to ${sequence.join(" + ")}`, details: { diagnosis, rx_count: rx.length, treatment_count: tOrders.length } });
      for (const dept of sequence) {
        const role = dept === "pharmacy" ? "pharmacy" : "treatment";
        await notify({
          to_role: role as any, from_role: "opd",
          visit_id: visitId, patient_id: patientId,
          message: `New ${role} order after lab review — ${detail.patients?.full_name} (Token ${detail.token_number})`,
        });
      }
    }

    await audit("OPD_POST_LAB_REVIEW", "visits", visitId, { decision, rx: rx.length, treatments: tOrders.length });
    toast.success("Review saved and patient routed");
    close(); load();
  };

  return (
    <div>
      <PageHeader title="Lab Results — Review" subtitle="Patients with completed lab tests awaiting your decision" />

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Token</TableHead><TableHead>Patient</TableHead><TableHead>Card</TableHead>
            <TableHead>Tests</TableHead><TableHead>Submitted</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.token_number}</TableCell>
                <TableCell>
                  <Link to={`/patient/${v.patient_id}`} className="font-medium text-sky-600 hover:underline">{v.patients?.full_name}</Link>
                  <div className="text-xs text-muted-foreground">{v.patients?.phone}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.patient_cards?.card_number}</TableCell>
                <TableCell className="text-xs">{(v.lab_results || []).map((l: any) => l.test_name).join(", ") || "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(v.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" onClick={() => openReview(v.id)}><Eye className="h-4 w-4" /> Review & Decide</Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No lab results awaiting review</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Sheet open={!!openId} onOpenChange={(o) => !o && close()}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader><SheetTitle>Lab Result Review</SheetTitle></SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <PatientBanner patient={detail.patients} token={detail.token_number} />

              {detail.opd_records?.[0] && (
                <Card><CardHeader><CardTitle className="text-base">Initial OPD Assessment</CardTitle></CardHeader>
                  <CardContent className="text-sm space-y-1">
                    {detail.opd_records[0].chief_complaint && <div><b>Chief complaint:</b> {detail.opd_records[0].chief_complaint}</div>}
                    {detail.opd_records[0].history && <div><b>HPI:</b> {detail.opd_records[0].history}</div>}
                    {detail.opd_records[0].examination && <div><b>Exam:</b> {detail.opd_records[0].examination}</div>}
                    {detail.opd_records[0].diagnosis && <div><b>Initial Dx:</b> {detail.opd_records[0].diagnosis}</div>}
                  </CardContent>
                </Card>
              )}

              <Card><CardHeader><CardTitle className="text-base">Lab Results</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Unit</TableHead><TableHead>Ref</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {(detail.lab_results || []).map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.test_name}</TableCell>
                          <TableCell>{l.result}</TableCell>
                          <TableCell>{l.unit}</TableCell>
                          <TableCell>{l.reference_range}</TableCell>
                          <TableCell><Badge variant={l.status === "Critical" ? "destructive" : l.status === "Abnormal" ? "secondary" : "outline"}>{l.status || "Normal"}</Badge></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card><CardHeader><CardTitle className="text-base">Update Plan</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1"><Label>Revised diagnosis</Label>
                    <Textarea rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Clinical notes</Label>
                    <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div className="space-y-1"><Label>Follow-up date</Label>
                      <Input type="date" value={followUp} onChange={(e) => setFollowUp(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Next step</Label>
                      <Select value={decision} onValueChange={(v: any) => setDecision(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discharge">Discharge (no further services)</SelectItem>
                          <SelectItem value="pharmacy">Send to Pharmacy</SelectItem>
                          <SelectItem value="treatment">Send to Treatment</SelectItem>
                          <SelectItem value="both">Send to Both</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {(decision === "pharmacy" || decision === "both") && (
                <Card><CardHeader><CardTitle className="text-base">Prescriptions</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid md:grid-cols-7 gap-2 items-end">
                      <div className="md:col-span-2 space-y-1"><Label>Medicine</Label><Input value={newRx.medicine_name} onChange={(e) => setNewRx({ ...newRx, medicine_name: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Dosage</Label><Input value={newRx.dosage} onChange={(e) => setNewRx({ ...newRx, dosage: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Route</Label>
                        <Select value={newRx.route} onValueChange={(v) => setNewRx({ ...newRx, route: v })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>{ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1"><Label>Freq</Label><Input value={newRx.frequency} onChange={(e) => setNewRx({ ...newRx, frequency: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Days</Label><Input value={newRx.duration} onChange={(e) => setNewRx({ ...newRx, duration: e.target.value })} /></div>
                      <div className="space-y-1"><Label>Qty</Label><Input value={newRx.quantity} onChange={(e) => setNewRx({ ...newRx, quantity: e.target.value })} /></div>
                      <div className="md:col-span-7"><Button onClick={addRx}><Plus className="h-4 w-4" /> Add medicine</Button></div>
                    </div>
                    {rx.length > 0 && (
                      <Table>
                        <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead><TableHead>Route</TableHead><TableHead>Freq</TableHead><TableHead>Days</TableHead><TableHead>Qty</TableHead><TableHead></TableHead></TableRow></TableHeader>
                        <TableBody>
                          {rx.map((r) => (
                            <TableRow key={r.id}>
                              <TableCell>{r.medicine_name}</TableCell><TableCell>{r.dosage}</TableCell>
                              <TableCell>{r.route}</TableCell><TableCell>{r.frequency}</TableCell>
                              <TableCell>{r.duration}</TableCell><TableCell>{r.quantity}</TableCell>
                              <TableCell><Button size="icon" variant="ghost" onClick={() => setRx(rx.filter((x) => x.id !== r.id))}><Trash2 className="h-4 w-4" /></Button></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              )}

              {(decision === "treatment" || decision === "both") && (
                <Card><CardHeader><CardTitle className="text-base">Treatment Orders</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid md:grid-cols-3 gap-2 items-end">
                      <div className="space-y-1"><Label>Procedure</Label><Input value={newT.procedure} onChange={(e) => setNewT({ ...newT, procedure: e.target.value })} /></div>
                      <div className="space-y-1 md:col-span-2"><Label>Notes</Label><Input value={newT.notes} onChange={(e) => setNewT({ ...newT, notes: e.target.value })} /></div>
                      <div className="md:col-span-3"><Button onClick={addTreatment}><Plus className="h-4 w-4" /> Add treatment</Button></div>
                    </div>
                    {tOrders.length > 0 && (
                      <ul className="text-sm space-y-1">
                        {tOrders.map((t) => (
                          <li key={t.id} className="flex items-center justify-between border rounded p-2">
                            <span><b>{t.procedure}</b> {t.notes && <span className="text-muted-foreground">— {t.notes}</span>}</span>
                            <Button size="icon" variant="ghost" onClick={() => setTOrders(tOrders.filter((x) => x.id !== t.id))}><Trash2 className="h-4 w-4" /></Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3 border-t">
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button onClick={confirmAndSend}><Send className="h-4 w-4" /> Confirm & Send</Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
