import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PatientBanner from "@/components/PatientBanner";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { audit, advance, fmtDateTime } from "@/lib/helpers";
import { toast } from "sonner";
import { ArrowRight, Plus, Trash2 } from "lucide-react";

const ROUTES = ["IV", "IM", "SC", "Oral", "Topical", "Inhaled", "Other"];

export default function TreatmentVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [rec, setRec] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [vitals, setVitals] = useState<any>(null);
  const [n, setN] = useState({
    procedure: "", route: "IV", medication_used: "", dose: "", dose_unit: "mg",
    start_time: "", end_time: "", findings: "", patient_response: "", complications: "", notes: "",
  });

  const load = async () => {
    const { data: v } = await supabase.from("visits").select("*,patients(*)").eq("id", id).single();
    setVisit(v);
    const { data: r } = await supabase.from("treatment_records").select("*").eq("visit_id", id).order("created_at");
    setRec(r ?? []);
    const { data: opd } = await supabase.from("opd_records").select("services_assigned,vital_signs").eq("visit_id", id).maybeSingle();
    setAssigned((opd?.services_assigned || []).filter((s: any) => s.type === "treatment"));
    setVitals(opd?.vital_signs || null);
  };
  useEffect(() => { load(); }, [id]);

  const add = async () => {
    if (!n.procedure) { toast.error("Procedure required"); return; }
    await supabase.from("treatment_records").insert({
      visit_id: id, patient_id: visit.patient_id,
      procedure: n.procedure, route: n.route, medication_used: n.medication_used || null,
      dose: n.dose || null, dose_unit: n.dose_unit || null,
      start_time: n.start_time || null, end_time: n.end_time || null,
      findings: n.findings || null, patient_response: n.patient_response || null,
      complications: n.complications || null, notes: n.notes || null,
    });
    setN({ procedure: "", route: "IV", medication_used: "", dose: "", dose_unit: "mg", start_time: "", end_time: "", findings: "", patient_response: "", complications: "", notes: "" });
    load();
    toast.success("Saved");
  };

  const removeRec = async (rid: string) => { await supabase.from("treatment_records").delete().eq("id", rid); load(); };

  const finish = async () => {
    await advance(visit);
    await audit("TREATMENT_DONE", "visits", id as string);
    toast.success("Treatment completed");
    nav("/treatment");
  };

  if (!visit) return <div>Loading…</div>;
  return (
    <div>
      <PageHeader title={`${visit.token_number} · ${visit.patients?.full_name}`}
        subtitle="Treatment session"
        action={<Button onClick={finish}><ArrowRight className="h-4 w-4" /> Complete & Forward</Button>} />

      <PatientBanner patient={visit.patients} token={visit.token_number} orderedServices={assigned} vitals={vitals} />

      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">New treatment record</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-4 gap-3">
          <div className="space-y-1 md:col-span-2"><Label>Procedure *</Label><Input value={n.procedure} onChange={(e) => setN({ ...n, procedure: e.target.value })} /></div>
          <div className="space-y-1"><Label>Route</Label>
            <Select value={n.route} onValueChange={(v) => setN({ ...n, route: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROUTES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Medication / material</Label><Input value={n.medication_used} onChange={(e) => setN({ ...n, medication_used: e.target.value })} /></div>
          <div className="space-y-1"><Label>Dose</Label><Input value={n.dose} onChange={(e) => setN({ ...n, dose: e.target.value })} /></div>
          <div className="space-y-1"><Label>Unit</Label><Input value={n.dose_unit} onChange={(e) => setN({ ...n, dose_unit: e.target.value })} /></div>
          <div className="space-y-1"><Label>Start time</Label><Input type="datetime-local" value={n.start_time} onChange={(e) => setN({ ...n, start_time: e.target.value })} /></div>
          <div className="space-y-1"><Label>End time</Label><Input type="datetime-local" value={n.end_time} onChange={(e) => setN({ ...n, end_time: e.target.value })} /></div>
          <div className="space-y-1 md:col-span-4"><Label>Findings / observations</Label><Textarea rows={2} value={n.findings} onChange={(e) => setN({ ...n, findings: e.target.value })} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Patient response</Label><Textarea rows={2} value={n.patient_response} onChange={(e) => setN({ ...n, patient_response: e.target.value })} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Complications</Label><Textarea rows={2} value={n.complications} onChange={(e) => setN({ ...n, complications: e.target.value })} /></div>
          <div className="space-y-1 md:col-span-4"><Label>Nurse/technician notes</Label><Textarea rows={2} value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} /></div>
          <div className="md:col-span-4 flex justify-end"><Button onClick={add}><Plus className="h-4 w-4" /> Add Record</Button></div>
        </CardContent>
      </Card>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Procedure</TableHead><TableHead>Route</TableHead><TableHead>Medication</TableHead>
            <TableHead>Dose</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead>
            <TableHead>Response</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rec.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.procedure}</TableCell>
                <TableCell>{r.route || "-"}</TableCell>
                <TableCell>{r.medication_used || "-"}</TableCell>
                <TableCell>{r.dose ? `${r.dose} ${r.dose_unit || ""}` : "-"}</TableCell>
                <TableCell className="text-xs">{r.start_time ? fmtDateTime(r.start_time) : "-"}</TableCell>
                <TableCell className="text-xs">{r.end_time ? fmtDateTime(r.end_time) : "-"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.patient_response || "-"}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => removeRec(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {rec.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-4">No records yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
