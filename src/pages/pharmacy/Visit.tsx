import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { audit, advance, fmtDateTime } from "@/lib/helpers";
import { toast } from "sonner";
import { CheckCircle2, Printer } from "lucide-react";
import { useReactToPrint } from "react-to-print";

export default function PharmacyVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [visit, setVisit] = useState<any>(null);
  const [rx, setRx] = useState<any[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const print = useReactToPrint({ contentRef: ref });

  const load = async () => {
    const { data: v } = await supabase.from("visits").select("*,patients(*)").eq("id", id).single();
    setVisit(v);
    const { data: r } = await supabase.from("prescriptions").select("*").eq("visit_id", id).order("created_at");
    setRx(r ?? []);
  };
  useEffect(() => { load(); }, [id]);

  const toggle = async (r: any, val: boolean) => {
    await supabase.from("prescriptions").update({
      dispensed_at: val ? new Date().toISOString() : null,
      dispensed_by: val ? user?.id ?? null : null,
    }).eq("id", r.id);
    load();
  };

  const finish = async () => {
    await advance(visit);
    await audit("PHARMACY_DONE", "visits", id as string);
    toast.success("Visit completed");
    nav("/pharmacy");
  };

  if (!visit) return <div>Loading…</div>;
  return (
    <div>
      <PageHeader title={`${visit.token_number} · ${visit.patients?.full_name}`}
        subtitle="Pharmacy dispensing"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={print}><Printer className="h-4 w-4" /> Print Rx</Button>
            <Button onClick={finish}><CheckCircle2 className="h-4 w-4" /> Complete Visit</Button>
          </div>
        } />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead></TableHead><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead><TableHead>Frequency</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
          <TableBody>
            {rx.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Checkbox checked={!!r.dispensed_at} onCheckedChange={(v) => toggle(r, !!v)} /></TableCell>
                <TableCell className="font-medium">{r.medicine_name}</TableCell>
                <TableCell>{r.dosage}</TableCell>
                <TableCell>{r.frequency}</TableCell>
                <TableCell>{r.duration}</TableCell>
                <TableCell><Badge variant={r.dispensed_at ? "default" : "secondary"}>{r.dispensed_at ? "dispensed" : "pending"}</Badge></TableCell>
              </TableRow>
            ))}
            {rx.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">No prescriptions</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <div ref={ref} className="hidden print:block p-6">
        <h2 className="text-xl font-semibold mb-2">Prescription</h2>
        <div className="text-sm mb-4">{visit.patients?.full_name} · {visit.token_number} · {fmtDateTime(new Date())}</div>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b"><th className="text-left p-2">Medicine</th><th className="text-left p-2">Dosage</th><th className="text-left p-2">Frequency</th><th className="text-left p-2">Duration</th></tr></thead>
          <tbody>{rx.map((r) => (<tr key={r.id} className="border-b"><td className="p-2">{r.medicine_name}</td><td className="p-2">{r.dosage}</td><td className="p-2">{r.frequency}</td><td className="p-2">{r.duration}</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
