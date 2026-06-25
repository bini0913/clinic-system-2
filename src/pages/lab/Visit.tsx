import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PatientBanner from "@/components/PatientBanner";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { audit, advance, fmtDateTime } from "@/lib/helpers";
import { toast } from "sonner";
import { ArrowRight, Plus, Printer, Trash2 } from "lucide-react";
import { useReactToPrint } from "react-to-print";

const STATUSES = ["Normal", "Abnormal", "Critical"];

export default function LabVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
  const [visit, setVisit] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [extra, setExtra] = useState({ test_name: "", result: "", unit: "", reference_range: "", status: "Normal", notes: "" });
  const printRef = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef: printRef });

  const load = async () => {
    const { data: v } = await supabase.from("visits").select("*,patients(*)").eq("id", id).single();
    setVisit(v);
    const { data: r } = await supabase.from("lab_results").select("*").eq("visit_id", id).order("created_at");
    setResults(r ?? []);
    const { data: opd } = await supabase.from("opd_records").select("services_assigned").eq("visit_id", id).maybeSingle();
    setAssigned((opd?.services_assigned || []).filter((s: any) => s.type === "lab"));
  };
  useEffect(() => { load(); }, [id]);

  if (!visit) return <div>Loading…</div>;

  const saveOrdered = async (svcName: string) => {
    const d = drafts[svcName]; if (!d?.result) { toast.error("Result required"); return; }
    await supabase.from("lab_results").insert({
      visit_id: id, patient_id: visit.patient_id,
      test_name: svcName, result: d.result, unit: d.unit || null,
      reference_range: d.reference_range || null, status: d.status || "Normal", notes: d.notes || null,
    });
    setDrafts({ ...drafts, [svcName]: { result: "", unit: "", reference_range: "", status: "Normal", notes: "" } });
    load();
  };

  const addExtra = async () => {
    if (!extra.test_name || !extra.result) { toast.error("Test and result required"); return; }
    await supabase.from("lab_results").insert({ ...extra, visit_id: id, patient_id: visit.patient_id });
    setExtra({ test_name: "", result: "", unit: "", reference_range: "", status: "Normal", notes: "" });
    load();
  };

  const removeResult = async (rid: string) => {
    await supabase.from("lab_results").delete().eq("id", rid); load();
  };

  const finish = async () => {
    await supabase.from("lab_results").update({ results_ready: true }).eq("visit_id", id);
    await advance(visit);
    await audit("LAB_DONE", "visits", id as string);
    toast.success("Lab completed — OPD notified");
    nav("/lab");
  };

  const setDraft = (svc: string, patch: any) =>
    setDrafts({ ...drafts, [svc]: { ...(drafts[svc] || { status: "Normal" }), ...patch } });

  return (
    <div>
      <PageHeader title={`${visit.token_number} · ${visit.patients?.full_name}`}
        subtitle="Laboratory"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Print Report</Button>
            <Button onClick={finish}><ArrowRight className="h-4 w-4" /> Complete & Forward</Button>
          </div>
        } />

      <PatientBanner patient={visit.patients} token={visit.token_number} orderedServices={assigned} />

      <div className="grid gap-4">
        {assigned.map((o: any) => {
          const d = drafts[o.service_name] || { status: "Normal" };
          return (
            <Card key={o.service_name}>
              <CardHeader><CardTitle className="text-base">{o.service_name}{o.clinical_indication && <span className="text-xs font-normal text-muted-foreground ml-2">— {o.clinical_indication}</span>}</CardTitle></CardHeader>
              <CardContent className="grid md:grid-cols-6 gap-2 items-end">
                <div className="space-y-1 md:col-span-2"><Label>Result *</Label><Input value={d.result || ""} onChange={(e) => setDraft(o.service_name, { result: e.target.value })} /></div>
                <div className="space-y-1"><Label>Unit</Label><Input value={d.unit || ""} onChange={(e) => setDraft(o.service_name, { unit: e.target.value })} /></div>
                <div className="space-y-1"><Label>Reference</Label><Input value={d.reference_range || ""} onChange={(e) => setDraft(o.service_name, { reference_range: e.target.value })} /></div>
                <div className="space-y-1"><Label>Status</Label>
                  <Select value={d.status || "Normal"} onValueChange={(v) => setDraft(o.service_name, { status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Button onClick={() => saveOrdered(o.service_name)}><Plus className="h-4 w-4" /> Save</Button>
                <div className="md:col-span-6"><Textarea rows={1} placeholder="Notes" value={d.notes || ""} onChange={(e) => setDraft(o.service_name, { notes: e.target.value })} /></div>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader><CardTitle className="text-base">Add additional test (not ordered)</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-6 gap-2 items-end">
            <div className="space-y-1 md:col-span-2"><Label>Test name *</Label><Input value={extra.test_name} onChange={(e) => setExtra({ ...extra, test_name: e.target.value })} /></div>
            <div className="space-y-1"><Label>Result *</Label><Input value={extra.result} onChange={(e) => setExtra({ ...extra, result: e.target.value })} /></div>
            <div className="space-y-1"><Label>Unit</Label><Input value={extra.unit} onChange={(e) => setExtra({ ...extra, unit: e.target.value })} /></div>
            <div className="space-y-1"><Label>Reference</Label><Input value={extra.reference_range} onChange={(e) => setExtra({ ...extra, reference_range: e.target.value })} /></div>
            <Button onClick={addExtra}><Plus className="h-4 w-4" /> Add</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">All results</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Unit</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead><TableHead></TableHead></TableRow></TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.test_name}</TableCell>
                    <TableCell>{r.result}</TableCell>
                    <TableCell>{r.unit}</TableCell>
                    <TableCell>{r.reference_range}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "Critical" ? "destructive" : r.status === "Abnormal" ? "secondary" : "outline"}>{r.status || "Normal"}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{r.notes}</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => removeResult(r.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                  </TableRow>
                ))}
                {results.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-4">No results yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div ref={printRef} className="hidden print:block p-8 text-black">
        <div className="text-center border-b pb-3 mb-4">
          <div className="text-2xl font-bold">{settings.clinic_name || "Clinic"}</div>
          <div className="text-xs">{settings.address || ""} {settings.phone ? `· ${settings.phone}` : ""}</div>
          <h2 className="text-lg font-semibold mt-3">LABORATORY REPORT</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div><b>Patient:</b> {visit.patients?.full_name}</div>
          <div><b>Token:</b> {visit.token_number}</div>
          <div><b>DOB:</b> {visit.patients?.dob || "-"}</div>
          <div><b>Gender:</b> {visit.patients?.gender || "-"}</div>
          <div><b>Blood type:</b> {visit.patients?.blood_type || "-"}</div>
          <div><b>Date:</b> {fmtDateTime(new Date())}</div>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-black"><th className="text-left p-2">Test</th><th className="text-left p-2">Result</th><th className="text-left p-2">Unit</th><th className="text-left p-2">Reference</th><th className="text-left p-2">Status</th></tr></thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b"><td className="p-2">{r.test_name}</td><td className="p-2">{r.result}</td><td className="p-2">{r.unit || "-"}</td><td className="p-2">{r.reference_range || "-"}</td><td className="p-2">{r.status || "Normal"}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
          <div><div className="border-t pt-1">Lab Technician</div><div>{user?.full_name || ""}</div></div>
          <div><div className="border-t pt-1">Doctor signature</div></div>
        </div>
      </div>
    </div>
  );
}
