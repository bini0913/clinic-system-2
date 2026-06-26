import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import PatientBanner from "@/components/PatientBanner";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { audit, advance, fmtDateTime } from "@/lib/helpers";
import { logActivity } from "@/lib/activity";
import { toast } from "sonner";
import { CheckCircle2, Printer, AlertTriangle } from "lucide-react";
import { useReactToPrint } from "react-to-print";

export default function PharmacyVisit() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { settings } = useSettings();
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

  const updateRow = async (r: any, patch: any) => {
    await supabase.from("prescriptions").update(patch).eq("id", r.id);
    load();
  };

  const toggleDispensed = async (r: any, val: boolean) => {
    await updateRow(r, { status: val ? "dispensed" : "pending", dispensed_at: val ? new Date().toISOString() : null, dispensed_by: val ? user?.id ?? null : null });
    if (val) await logActivity({ patient_id: visit.patient_id, visit_id: id as string, department: "pharmacy", action: `Dispensed — ${r.medicine_name}`, details: { qty: r.quantity, batch: r.batch_number } });
  };

  const toggleOOS = (r: any) =>
    updateRow(r, { out_of_stock: !r.out_of_stock, status: !r.out_of_stock ? "out_of_stock" : "pending" });

  const finish = async () => {
    await advance(visit);
    await audit("PHARMACY_DONE", "visits", id as string);
    toast.success("Visit completed");
    nav("/pharmacy");
  };

  if (!visit) return <div>Loading…</div>;
  const hasOOS = rx.some((r) => r.out_of_stock);

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

      <PatientBanner patient={visit.patients} token={visit.token_number} />

      {hasOOS && (
        <div className="mb-3 flex items-center gap-2 p-3 rounded-md bg-amber-50 text-amber-900 text-sm">
          <AlertTriangle className="h-4 w-4" /> One or more medicines are out of stock.
        </div>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead></TableHead><TableHead>Medicine</TableHead><TableHead>Dosage</TableHead>
            <TableHead>Route</TableHead><TableHead>Freq</TableHead><TableHead>Duration</TableHead>
            <TableHead>Qty</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rx.map((r) => (
              <TableRow key={r.id} className={r.out_of_stock ? "bg-amber-50/40" : ""}>
                <TableCell><Checkbox checked={r.status === "dispensed"} onCheckedChange={(v) => toggleDispensed(r, !!v)} disabled={r.out_of_stock} /></TableCell>
                <TableCell className="font-medium">{r.medicine_name}</TableCell>
                <TableCell>{r.dosage}</TableCell>
                <TableCell>{r.route || "-"}</TableCell>
                <TableCell>{r.frequency}</TableCell>
                <TableCell>{r.duration}</TableCell>
                <TableCell>
                  <Input className="h-8 w-20" defaultValue={r.quantity ?? ""} onBlur={(e) => updateRow(r, { quantity: e.target.value ? Number(e.target.value) : null })} />
                </TableCell>
                <TableCell>
                  <Input className="h-8 w-24" defaultValue={r.batch_number ?? ""} onBlur={(e) => updateRow(r, { batch_number: e.target.value || null })} />
                </TableCell>
                <TableCell>
                  <Input type="date" className="h-8 w-36" defaultValue={r.expiry_date ?? ""} onBlur={(e) => updateRow(r, { expiry_date: e.target.value || null })} />
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "dispensed" ? "default" : r.out_of_stock ? "destructive" : "secondary"}>
                    {r.out_of_stock ? "out of stock" : r.status === "dispensed" ? "dispensed" : "pending"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="outline" onClick={() => toggleOOS(r)}>{r.out_of_stock ? "In stock" : "Out of stock"}</Button>
                </TableCell>
              </TableRow>
            ))}
            {rx.length === 0 && <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-6">No prescriptions</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <div ref={ref} className="hidden print:block p-8 text-black">
        <div className="text-center border-b pb-3 mb-4">
          <div className="text-2xl font-bold">{settings.clinic_name || "Clinic"}</div>
          <div className="text-xs">{settings.address || ""} {settings.phone ? `· ${settings.phone}` : ""}</div>
          <h2 className="text-lg font-semibold mt-3">PRESCRIPTION</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm mb-4">
          <div><b>Patient:</b> {visit.patients?.full_name}</div>
          <div><b>Token:</b> {visit.token_number}</div>
          <div><b>Date:</b> {fmtDateTime(new Date())}</div>
          <div><b>Allergies:</b> {visit.patients?.allergies || "None"}</div>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-black"><th className="text-left p-2">Medicine</th><th className="text-left p-2">Dosage</th><th className="text-left p-2">Route</th><th className="text-left p-2">Freq</th><th className="text-left p-2">Duration</th><th className="text-left p-2">Qty</th></tr></thead>
          <tbody>
            {rx.map((r) => (
              <tr key={r.id} className="border-b"><td className="p-2">{r.medicine_name}</td><td className="p-2">{r.dosage}</td><td className="p-2">{r.route || "-"}</td><td className="p-2">{r.frequency}</td><td className="p-2">{r.duration}</td><td className="p-2">{r.quantity ?? "-"}</td></tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 gap-8 mt-12 text-sm">
          <div><div className="border-t pt-1">Dispensed by</div><div>{user?.full_name || ""}</div></div>
          <div><div className="border-t pt-1">Signature</div></div>
        </div>
      </div>
    </div>
  );
}
