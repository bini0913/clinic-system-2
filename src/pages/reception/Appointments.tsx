import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { audit, fmtDateTime, nextTokenLabel } from "@/lib/helpers";
import { toast } from "sonner";
import { Plus, UserCheck } from "lucide-react";
import { format } from "date-fns";

export default function ReceptionAppointments() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  // booking form
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [patient, setPatient] = useState<any | null>(null);
  const [when, setWhen] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const dayKey = useMemo(() => date ? format(date, "yyyy-MM-dd") : "", [date]);

  const load = async () => {
    if (!date) return;
    const start = new Date(date); start.setHours(0, 0, 0, 0);
    const end = new Date(date); end.setHours(23, 59, 59, 999);
    const { data } = await supabase.from("appointments")
      .select("*,patients(full_name,phone)")
      .gte("scheduled_at", start.toISOString())
      .lte("scheduled_at", end.toISOString())
      .order("scheduled_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [dayKey]);

  const searchPatients = async (s: string) => {
    setQ(s);
    if (!s.trim()) { setPatients([]); return; }
    const { data } = await supabase.from("patients").select("id,full_name,phone")
      .or(`full_name.ilike.%${s}%,phone.ilike.%${s}%`).limit(10);
    setPatients(data ?? []);
  };

  const book = async () => {
    if (!patient || !when) { toast.error("Pick patient and time"); return; }
    setSaving(true);
    const { data, error } = await supabase.from("appointments").insert({
      patient_id: patient.id,
      scheduled_at: new Date(when).toISOString(),
      notes,
      status: "scheduled",
    }).select().single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await audit("APPOINTMENT_BOOKED", "appointments", data.id, { patient: patient.full_name });
    toast.success("Appointment booked");
    setOpen(false);
    setPatient(null); setQ(""); setPatients([]); setWhen(""); setNotes("");
    load();
  };

  const markArrived = async (a: any) => {
    // create patient_card (new card per visit) and visit
    const year = new Date().getFullYear();
    const cardNumber = `CRD-${year}-${Math.floor(10000 + Math.random() * 90000)}`;
    const { data: card, error: cErr } = await supabase.from("patient_cards")
      .insert({ patient_id: a.patient_id, card_number: cardNumber }).select().single();
    if (cErr) { toast.error(cErr.message); return; }
    const token = await nextTokenLabel();
    const { data: visit, error: vErr } = await supabase.from("visits").insert({
      patient_id: a.patient_id,
      card_id: card.id,
      token_number: token,
      status: "opd_waiting",
      service_sequence: [],
      current_step_index: 0,
    }).select().single();
    if (vErr) { toast.error(vErr.message); return; }
    await supabase.from("appointments").update({ status: "arrived" }).eq("id", a.id);
    await audit("APPOINTMENT_ARRIVED", "appointments", a.id, { visit_id: visit.id, token });
    toast.success(`Arrived — ${token}`);
    load();
  };

  return (
    <div>
      <PageHeader title="Appointments" subtitle="Schedule and manage patient appointments"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Book Appointment</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New appointment</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Patient</Label>
                  <Input placeholder="Search name or phone…" value={q} onChange={(e) => searchPatients(e.target.value)} />
                  {patient ? (
                    <div className="text-sm p-2 border rounded-md flex items-center justify-between">
                      <span>{patient.full_name} · {patient.phone}</span>
                      <Button variant="ghost" size="sm" onClick={() => { setPatient(null); setQ(""); }}>Change</Button>
                    </div>
                  ) : (
                    <div className="border rounded-md divide-y max-h-40 overflow-auto">
                      {patients.map((p) => (
                        <button key={p.id} className="w-full text-left p-2 hover:bg-muted"
                          onClick={() => { setPatient(p); setPatients([]); setQ(""); }}>
                          <div className="text-sm font-medium">{p.full_name}</div>
                          <div className="text-xs text-muted-foreground">{p.phone}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1"><Label>Date & time</Label>
                  <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></div>
                <div className="space-y-1"><Label>Notes</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              </div>
              <DialogFooter><Button onClick={book} disabled={saving}>{saving ? "Saving…" : "Book"}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1"><CardContent className="p-3 flex justify-center">
          <Calendar mode="single" selected={date} onSelect={setDate} />
        </CardContent></Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{date ? format(date, "PPPP") : "Select a date"}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Time</TableHead><TableHead>Patient</TableHead><TableHead>Notes</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs">{fmtDateTime(a.scheduled_at)}</TableCell>
                    <TableCell>{a.patients?.full_name} <div className="text-xs text-muted-foreground">{a.patients?.phone}</div></TableCell>
                    <TableCell className="text-muted-foreground text-xs max-w-xs truncate">{a.notes}</TableCell>
                    <TableCell><Badge variant={a.status === "arrived" ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {a.status !== "arrived" && (
                        <Button size="sm" onClick={() => markArrived(a)}>
                          <UserCheck className="h-4 w-4" /> Mark Arrived
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No appointments</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
