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

export default function TreatmentVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const [visit, setVisit] = useState<any>(null);
  const [rec, setRec] = useState<any[]>([]);
  const [n, setN] = useState({ procedure: "", findings: "", notes: "" });

  const load = async () => {
    const { data: v } = await supabase.from("visits").select("*,patients(*)").eq("id", id).single();
    setVisit(v);
    const { data: r } = await supabase.from("treatment_records").select("*").eq("visit_id", id).order("created_at");
    setRec(r ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const add = async () => {
    if (!n.procedure) return;
    await supabase.from("treatment_records").insert({ ...n, visit_id: id, patient_id: visit.patient_id });
    setN({ procedure: "", findings: "", notes: "" });
    load();
    toast.success("Saved");
  };

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
      <Card><CardContent className="p-4 space-y-3">
        <div className="grid md:grid-cols-3 gap-2 items-end">
          <div className="space-y-1"><Label>Procedure</Label><Input value={n.procedure} onChange={(e) => setN({ ...n, procedure: e.target.value })} /></div>
          <div className="space-y-1 md:col-span-2"><Label>Findings</Label><Input value={n.findings} onChange={(e) => setN({ ...n, findings: e.target.value })} /></div>
        </div>
        <Textarea placeholder="Notes" value={n.notes} onChange={(e) => setN({ ...n, notes: e.target.value })} />
        <Button onClick={add}><Plus className="h-4 w-4" /> Add Record</Button>
        <Table>
          <TableHeader><TableRow><TableHead>Procedure</TableHead><TableHead>Findings</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
          <TableBody>
            {rec.map((r) => <TableRow key={r.id}><TableCell className="font-medium">{r.procedure}</TableCell><TableCell>{r.findings}</TableCell><TableCell className="text-muted-foreground">{r.notes}</TableCell></TableRow>)}
            {rec.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No records yet</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
