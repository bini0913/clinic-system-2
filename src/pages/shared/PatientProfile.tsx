import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ArrowLeft, AlertTriangle, Heart, Droplet, Phone, Shield, CreditCard, Printer, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { fmtDate, fmtDateTime, fmtETB } from "@/lib/helpers";
import { statusLabel, statusColor, STAGES, activeStageIndex } from "@/lib/visitStatus";
import { cn } from "@/lib/utils";

function age(dob?: string | null) {
  if (!dob) return null;
  const b = new Date(dob); if (isNaN(b.getTime())) return null;
  const n = new Date(); let a = n.getFullYear() - b.getFullYear();
  const m = n.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
  return a;
}

const deptColor: Record<string, string> = {
  reception: "bg-sky-100 text-sky-800",
  opd: "bg-indigo-100 text-indigo-800",
  laboratory: "bg-emerald-100 text-emerald-800",
  treatment: "bg-amber-100 text-amber-800",
  pharmacy: "bg-rose-100 text-rose-800",
  admin: "bg-slate-100 text-slate-800",
};

function ProgressTracker({ status }: { status?: string | null }) {
  const idx = activeStageIndex(status);
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2">
      {STAGES.map((s, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <div key={s.key} className="flex items-center gap-1 shrink-0">
            <div className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border",
              done ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : active ? "bg-sky-50 text-sky-700 border-sky-300 font-semibold"
                : "bg-muted text-muted-foreground border-transparent",
            )}>
              {done ? <CheckCircle2 className="h-3 w-3" /> : active ? <Loader2 className="h-3 w-3 animate-spin" /> : <Circle className="h-3 w-3" />}
              {s.label}
            </div>
            {i < STAGES.length - 1 && <div className={cn("h-px w-4", done ? "bg-emerald-300" : "bg-border")} />}
          </div>
        );
      })}
    </div>
  );
}

function CurrentVisit({ visit, cards }: { visit: any; cards: any[] }) {
  const o = visit.opd_records?.[0];
  const vit = o?.vital_signs || {};
  const card = cards.find((c) => c.id === visit.card_id) || cards[0];
  const cardPayment = (visit.payments || []).find((p: any) => p.payment_type === "card_fee");
  const svcPayments = (visit.payments || []).filter((p: any) => p.payment_type !== "card_fee");
  return (
    <Card className="border-l-4 border-l-emerald-500">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-base">Current Visit — <span className="font-mono">{visit.token_number}</span></CardTitle>
          <Badge className={statusColor(visit.status)}>{statusLabel(visit.status)}</Badge>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Live
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ProgressTracker status={visit.status} />

        <section className="rounded-md border p-3">
          <h4 className="text-xs uppercase text-muted-foreground mb-2">Reception</h4>
          <div className="text-sm flex flex-wrap gap-x-4 gap-y-1">
            <span><b>Registered:</b> {fmtDateTime(visit.created_at)}</span>
            {card && <span><b>Card:</b> <span className="font-mono">{card.card_number}</span></span>}
            {cardPayment && <span><b>Card fee:</b> <Badge variant={cardPayment.status === "paid" ? "default" : "secondary"}>{cardPayment.status}</Badge></span>}
          </div>
        </section>

        {o && (
          <section className="rounded-md border p-3">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">OPD</h4>
            <div className="grid md:grid-cols-2 gap-2 text-sm">
              {o.chief_complaint && <div><b>Chief complaint:</b> {o.chief_complaint}</div>}
              {o.history && <div><b>HPI:</b> {o.history}</div>}
              {o.examination && <div className="md:col-span-2"><b>Exam:</b> {o.examination}</div>}
              {o.diagnosis && <div><b>Diagnosis:</b> {o.diagnosis}</div>}
              {o.secondary_diagnosis && <div><b>Secondary Dx:</b> {o.secondary_diagnosis}</div>}
              {o.notes && <div className="md:col-span-2"><b>Notes:</b> {o.notes}</div>}
            </div>
            {Object.values(vit).some(Boolean) && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {vit.temp && <span>Temp <b>{vit.temp}°C</b></span>}
                {(vit.bp_systolic || vit.bp_diastolic) && <span>BP <b>{vit.bp_systolic}/{vit.bp_diastolic}</b></span>}
                {vit.heart_rate && <span>HR <b>{vit.heart_rate}</b></span>}
                {vit.spo2 && <span>SpO₂ <b>{vit.spo2}%</b></span>}
                {vit.weight && <span>Wt <b>{vit.weight}kg</b></span>}
                {vit.bmi && <span>BMI <b>{vit.bmi}</b></span>}
              </div>
            )}
            {(o.services_assigned?.length > 0) && (
              <div className="mt-2 text-xs">
                <b>Services ordered:</b>{" "}
                {o.services_assigned.map((s: any, i: number) => (
                  <Badge key={i} variant="outline" className="mr-1">{s.type}: {s.service_name}</Badge>
                ))}
              </div>
            )}
            {o.post_lab_review_at && (
              <div className="mt-3 p-2 rounded bg-amber-50 border border-amber-200 text-xs">
                <div className="font-semibold text-amber-900">Updated after lab review · {fmtDateTime(o.post_lab_review_at)}</div>
                {o.post_lab_review_diagnosis && <div><b>Revised Dx:</b> {o.post_lab_review_diagnosis}</div>}
                {o.post_lab_review_notes && <div><b>Notes:</b> {o.post_lab_review_notes}</div>}
              </div>
            )}
          </section>
        )}

        {visit.lab_results?.length > 0 && (
          <section className="rounded-md border p-3">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Laboratory</h4>
            <Table>
              <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Unit</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {visit.lab_results.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.test_name}</TableCell><TableCell>{l.result}</TableCell>
                    <TableCell>{l.unit}</TableCell><TableCell>{l.reference_range}</TableCell>
                    <TableCell>
                      <Badge className={
                        l.status === "Critical" ? "bg-red-100 text-red-800 border-red-200"
                        : l.status === "Abnormal" ? "bg-orange-100 text-orange-800 border-orange-200"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                      }>{l.status || "Normal"}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {visit.treatment_records?.length > 0 && (
          <section className="rounded-md border p-3">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Treatment</h4>
            {visit.treatment_records.map((t: any) => (
              <div key={t.id} className="text-sm py-1">
                <div><b>{t.procedure}</b>{t.route && <span className="text-muted-foreground"> ({t.route})</span>}</div>
                {t.medication_used && <div className="text-xs">{t.medication_used} {t.dose ?? ""}{t.dose_unit ?? ""}</div>}
                {(t.start_time || t.end_time) && <div className="text-xs text-muted-foreground">{t.start_time ? fmtDateTime(t.start_time) : "-"} → {t.end_time ? fmtDateTime(t.end_time) : "-"}</div>}
                {t.patient_response && <div className="text-xs"><b>Response:</b> {t.patient_response}</div>}
                {t.complications && <div className="text-xs text-amber-700"><b>Complications:</b> {t.complications}</div>}
              </div>
            ))}
          </section>
        )}

        {visit.prescriptions?.length > 0 && (
          <section className="rounded-md border p-3">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Pharmacy</h4>
            <Table>
              <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead><TableHead>Route</TableHead><TableHead>Freq</TableHead><TableHead>Days</TableHead><TableHead>Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {visit.prescriptions.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.medicine_name}</TableCell><TableCell>{p.dosage}</TableCell>
                    <TableCell>{p.route}</TableCell><TableCell>{p.frequency}</TableCell>
                    <TableCell>{p.duration}</TableCell><TableCell>{p.quantity}</TableCell>
                    <TableCell><Badge variant={p.status === "dispensed" ? "default" : "secondary"}>{p.status || "pending"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {svcPayments.length > 0 && (
          <section className="rounded-md border p-3">
            <h4 className="text-xs uppercase text-muted-foreground mb-2">Payments</h4>
            {svcPayments.map((p: any) => (
              <div key={p.id} className="flex justify-between text-sm border-b py-1 last:border-0">
                <span>{p.payment_type} · {p.method} {p.discount_amount ? <span className="text-xs text-muted-foreground">(disc {fmtETB(p.discount_amount)})</span> : null}</span>
                <span><Badge variant={p.status === "paid" ? "default" : "secondary"} className="mr-2">{p.status}</Badge>{fmtETB(p.total_amount)}</span>
              </div>
            ))}
          </section>
        )}
      </CardContent>
    </Card>
  );
}

export default function PatientProfile() {
  const { patientId } = useParams();
  const nav = useNavigate();
  const [patient, setPatient] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const load = async () => {
    const { data: p } = await supabase.from("patients").select("*").eq("id", patientId).single();
    setPatient(p);
    const { data: c } = await supabase.from("patient_cards").select("*").eq("patient_id", patientId).order("created_at", { ascending: false });
    setCards(c ?? []);
    const { data: v } = await supabase.from("visits")
      .select("*,opd_records(*),lab_results(*),treatment_records(*),prescriptions(*),payments(*)")
      .eq("patient_id", patientId).order("created_at", { ascending: false });
    setVisits(v ?? []);
    const { data: a } = await supabase.from("patient_activity_log")
      .select("*,users(full_name,email)")
      .eq("patient_id", patientId).order("created_at", { ascending: false }).limit(500);
    setActivity(a ?? []);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [patientId]);

  // Real-time updates for this patient across all relevant tables
  useEffect(() => {
    if (!patientId) return;
    const ch = supabase.channel(`patient-${patientId}`);
    ["visits", "opd_records", "lab_results", "treatment_records", "prescriptions", "payments", "patient_activity_log"].forEach((t) => {
      ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => load());
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [patientId]);

  if (!patient) return <div className="p-6">Loading…</div>;

  const filteredActivity = deptFilter === "all" ? activity : activity.filter((a) => a.department === deptFilter);
  const currentVisit = visits.find((v) => v.status !== "completed");


  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>

      <Card className="border-l-4 border-l-sky-500">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-semibold">{patient.full_name}</h1>
                {patient.blood_type && <Badge className="bg-rose-100 text-rose-800"><Droplet className="h-3 w-3 mr-1" />{patient.blood_type}</Badge>}
                {patient.gender && <Badge variant="outline">{patient.gender}</Badge>}
                {age(patient.dob) != null && <Badge variant="secondary">{age(patient.dob)}y</Badge>}
              </div>
              <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                {patient.dob && <span>DOB {fmtDate(patient.dob)}</span>}
                {patient.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
                {patient.secondary_phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.secondary_phone}</span>}
              </div>
              {patient.address && <div className="text-sm text-muted-foreground mt-1">{patient.address}</div>}
            </div>
            <div className="text-right text-xs space-y-1">
              {cards.map((c) => (
                <Badge key={c.id} variant="outline" className="font-mono"><CreditCard className="h-3 w-3 mr-1" />{c.card_number}</Badge>
              ))}
            </div>
          </div>

          {patient.allergies && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 text-red-900 border border-red-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div><b>Allergies:</b> {patient.allergies}</div>
            </div>
          )}
          {patient.chronic_conditions && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-orange-50 text-orange-900 border border-orange-200">
              <Heart className="h-4 w-4 mt-0.5 shrink-0" />
              <div><b>Chronic conditions:</b> {patient.chronic_conditions}</div>
            </div>
          )}
          {patient.current_medications && (
            <div className="text-sm">
              <span className="text-muted-foreground">Current medications: </span>
              {patient.current_medications.split(/[,;]/).map((m: string, i: number) => m.trim() && (
                <Badge key={i} variant="secondary" className="mr-1 mb-1">{m.trim()}</Badge>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4 text-sm">
            {patient.emergency_contact_name && (
              <div className="p-3 rounded-md border">
                <div className="text-xs text-muted-foreground mb-1">Emergency Contact</div>
                <div className="font-medium">{patient.emergency_contact_name}</div>
                <div className="text-muted-foreground">{patient.emergency_contact_relationship} · {patient.emergency_contact_phone}</div>
              </div>
            )}
            {(patient.insurance_provider || patient.insurance_policy_number) && (
              <div className="p-3 rounded-md border">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Shield className="h-3 w-3" /> Insurance</div>
                <div className="font-medium">{patient.insurance_provider}</div>
                <div className="text-muted-foreground font-mono">{patient.insurance_policy_number}</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">Visit Timeline ({visits.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity Log ({activity.length})</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-3">
          {visits.length === 0 && <div className="text-sm text-muted-foreground p-4">No visits yet.</div>}
          {visits.map((v) => {
            const o = v.opd_records?.[0];
            const vit = o?.vital_signs || {};
            return (
              <details key={v.id} className="border rounded-md bg-card">
                <summary className="cursor-pointer p-4 flex flex-wrap gap-3 items-center">
                  <span className="font-mono font-semibold">{v.token_number}</span>
                  <span className="text-sm">{fmtDateTime(v.created_at)}</span>
                  <Badge variant={v.status === "completed" ? "default" : "secondary"}>{v.status}</Badge>
                  {o?.diagnosis && <span className="text-sm truncate max-w-md">Dx: {o.diagnosis}</span>}
                </summary>
                <div className="p-4 pt-0 space-y-4 text-sm">
                  {o && (
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">OPD</h4>
                      <div className="grid md:grid-cols-2 gap-2">
                        {o.chief_complaint && <div><b>Chief complaint:</b> {o.chief_complaint}</div>}
                        {o.diagnosis && <div><b>Diagnosis:</b> {o.diagnosis}</div>}
                        {o.follow_up_date && <div><b>Follow-up:</b> {fmtDate(o.follow_up_date)}</div>}
                        {o.notes && <div className="md:col-span-2"><b>Notes:</b> {o.notes}</div>}
                      </div>
                      {Object.values(vit).some(Boolean) && (
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {vit.temp && <span>Temp <b>{vit.temp}°C</b></span>}
                          {(vit.bp_systolic || vit.bp_diastolic) && <span>BP <b>{vit.bp_systolic}/{vit.bp_diastolic}</b></span>}
                          {vit.heart_rate && <span>HR <b>{vit.heart_rate}</b></span>}
                          {vit.spo2 && <span>SpO₂ <b>{vit.spo2}%</b></span>}
                          {vit.weight && <span>Wt <b>{vit.weight}kg</b></span>}
                          {vit.bmi && <span>BMI <b>{vit.bmi}</b></span>}
                        </div>
                      )}
                    </section>
                  )}
                  {v.lab_results?.length > 0 && (
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Lab results</h4>
                      <Table>
                        <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Unit</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {v.lab_results.map((l: any) => (
                            <TableRow key={l.id}>
                              <TableCell>{l.test_name}</TableCell><TableCell>{l.result}</TableCell>
                              <TableCell>{l.unit}</TableCell><TableCell>{l.reference_range}</TableCell>
                              <TableCell><Badge variant={l.status === "Critical" ? "destructive" : l.status === "Abnormal" ? "secondary" : "outline"}>{l.status || "Normal"}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>
                  )}
                  {v.treatment_records?.length > 0 && (
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Treatment</h4>
                      {v.treatment_records.map((t: any) => (
                        <div key={t.id} className="border rounded p-2 mb-2">
                          <div className="font-medium">{t.procedure} {t.route && <span className="text-muted-foreground text-xs">({t.route})</span>}</div>
                          <div className="text-xs">{t.medication_used && `${t.medication_used} ${t.dose ?? ""}${t.dose_unit ?? ""}`}</div>
                          {(t.start_time || t.end_time) && <div className="text-xs text-muted-foreground">{t.start_time ? fmtDateTime(t.start_time) : "-"} → {t.end_time ? fmtDateTime(t.end_time) : "-"}</div>}
                          {t.patient_response && <div className="text-xs"><b>Response:</b> {t.patient_response}</div>}
                          {t.complications && <div className="text-xs text-amber-700"><b>Complications:</b> {t.complications}</div>}
                        </div>
                      ))}
                    </section>
                  )}
                  {v.prescriptions?.length > 0 && (
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Prescriptions</h4>
                      <Table>
                        <TableHeader><TableRow><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead><TableHead>Route</TableHead><TableHead>Freq</TableHead><TableHead>Duration</TableHead><TableHead>Qty</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {v.prescriptions.map((p: any) => (
                            <TableRow key={p.id}>
                              <TableCell>{p.medicine_name}</TableCell><TableCell>{p.dosage}</TableCell>
                              <TableCell>{p.route}</TableCell><TableCell>{p.frequency}</TableCell>
                              <TableCell>{p.duration}</TableCell><TableCell>{p.quantity}</TableCell>
                              <TableCell><Badge variant={p.status === "dispensed" ? "default" : "secondary"}>{p.status || "pending"}</Badge></TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </section>
                  )}
                  {v.payments?.length > 0 && (
                    <section>
                      <h4 className="font-semibold text-xs uppercase text-muted-foreground mb-2">Payments</h4>
                      {v.payments.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-xs border-b py-1">
                          <span>{p.payment_type} · {p.method}</span>
                          <span><Badge variant={p.status === "paid" ? "default" : "secondary"} className="mr-2">{p.status}</Badge>{fmtETB(p.total_amount)}</span>
                        </div>
                      ))}
                    </section>
                  )}
                </div>
              </details>
            );
          })}
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Activity</CardTitle>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All departments</SelectItem>
                  <SelectItem value="reception">Reception</SelectItem>
                  <SelectItem value="opd">OPD</SelectItem>
                  <SelectItem value="laboratory">Laboratory</SelectItem>
                  <SelectItem value="treatment">Treatment</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Department</TableHead><TableHead>Action</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filteredActivity.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(a.created_at)}</TableCell>
                      <TableCell><Badge className={deptColor[a.department] || ""}>{a.department}</Badge></TableCell>
                      <TableCell>{a.action}</TableCell>
                      <TableCell className="text-xs">{a.users?.full_name || "-"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredActivity.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No activity</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-3">
          {visits.map((v) => (
            <Card key={v.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-mono">{v.token_number}</div>
                  <div className="text-xs text-muted-foreground">{fmtDateTime(v.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => window.open(`/patient/${patientId}?print=visit&visit=${v.id}`, "_blank")}><Printer className="h-4 w-4" /> Visit Summary</Button>
                  {v.lab_results?.length > 0 && <Button size="sm" variant="outline" onClick={() => window.open(`/lab/visit/${v.id}`, "_blank")}><Printer className="h-4 w-4" /> Lab Report</Button>}
                  {v.prescriptions?.length > 0 && <Button size="sm" variant="outline" onClick={() => window.open(`/pharmacy/visit/${v.id}`, "_blank")}><Printer className="h-4 w-4" /> Prescription</Button>}
                </div>
              </CardContent>
            </Card>
          ))}
          {visits.length === 0 && <div className="text-sm text-muted-foreground p-4">No documents.</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
