import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { audit, advance } from "@/lib/helpers";
import { toast } from "sonner";
import { ArrowRight, Plus } from "lucide-react";

export default function LabVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [assigned, setAssigned] = useState<any[]>([]);
  const [n, setN] = useState({ test_name: "", result_value: "", reference_range: "", notes: "" });

  const load = async () => {
    const { data: v } = await supabase.from("visits").select("*,patients(*)").eq("id", id).single();
    setVisit(v);
    const { data: r } = await supabase.from("lab_results").select("*").eq("visit_id", id).order("created_at");
    setResults(r ?? []);
    const { data: opd } = await supabase.from("opd_records").select("services_assigned").eq("visit_id", id).maybeSingle();
    setAssigned((opd?.services_assigned || []).filter((s: any) => s.type === "lab"));
  };
  useEffect(() => { load(); }, [id]);

  const addResult = async () => {
    if (!n.test_name) return;
    await supabase.from("lab_results").insert({ ...n, visit_id: id, patient_id: visit.patient_id });
    setN({ test_name: "", result_value: "", reference_range: "", notes: "" });
    load();
    toast.success("Result added");
  };

  const finish = async () => {
    await advance(visit);
    await audit("LAB_DONE", "visits", id as string);
    toast.success("Lab completed");
    nav("/lab");
  };

  if (!visit) return <div>Loading…</div>;
  return (
    <div>
      <PageHeader title={`${visit.token_number} · ${visit.patients?.full_name}`}
        subtitle="Laboratory"
        action={<Button onClick={finish}><ArrowRight className="h-4 w-4" /> Complete & Forward</Button>} />
      <Card className="mb-4"><CardContent className="p-4">
        <div className="text-sm font-medium mb-2">Ordered tests</div>
        <ul className="text-sm list-disc pl-5">
          {assigned.map((o, i) => <li key={i}>{o.service_name}</li>)}
          {assigned.length === 0 && <li className="text-muted-foreground">No specific orders</li>}
        </ul>
      </CardContent></Card>
      <Card><CardContent className="p-4 space-y-3">
        <div className="grid md:grid-cols-4 gap-2 items-end">
          <div className="space-y-1"><Label>Test name</Label><Input value={n.test_name} onChange={(e) => setN({ ...n, test_name: e.target.value })} /></div>
          <div className="space-y-1"><Label>Result</Label><Input value={n.result_value} onChange={(e) => setN({ ...n, result_value: e.target.value })} /></div>
          <div className="space-y-1"><Label>Reference</Label><Input value={n.reference_range} onChange={(e) => setN({ ...n, reference_range: e.target.value })} /></div>
          <Button onClick={addResult}><Plus className="h-4 w-4" /> Add Result</Button>
        </div>
        <Textarea placeholder="Notes (optional)" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
        <Table>
          <TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Result</TableHead><TableHead>Range</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>
            {results.map((r) => (
              <TableRow key={r.id}><TableCell className="font-medium">{r.test_name}</TableCell><TableCell>{r.result_value}</TableCell><TableCell>{r.reference_range}</TableCell><TableCell className="text-muted-foreground">{r.notes}</TableCell></TableRow>
            ))}
            {results.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">No results yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
