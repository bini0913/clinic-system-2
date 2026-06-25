import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { audit, genCardNumber, nextTokenLabel, fmtETB } from "@/lib/helpers";
import { toast } from "sonner";
import { ArrowRight, Search, UserPlus, CreditCard } from "lucide-react";

type Step = 1 | 2;

export default function ReceptionRegister() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [form, setForm] = useState({
    full_name: "", dob: "", gender: "Male", phone: "", address: "", allergies: "",
  });

  // Step 2
  const [cardNumber, setCardNumber] = useState(genCardNumber());
  const [method, setMethod] = useState<"cash" | "transfer">("cash");
  const [bank, setBank] = useState<string>("");
  const [ref, setRef] = useState("");

  const cardFee = Number(settings.card_fee ?? 50);
  const banks: string[] = (settings.banks as string[]) || [];

  const search = async () => {
    if (!q.trim()) { setResults([]); return; }
    const { data } = await supabase.from("patients").select("*")
      .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(20);
    setResults(data ?? []);
  };

  const pick = (p: any) => {
    setPicked(p);
    setForm({
      full_name: p.full_name || "",
      dob: p.dob ? String(p.dob).slice(0, 10) : "",
      gender: p.gender || "Male",
      phone: p.phone || "",
      address: p.address || "",
      allergies: p.allergies || "",
    });
  };

  const startNew = () => {
    setPicked(null);
    setForm({ full_name: "", dob: "", gender: "Male", phone: "", address: "", allergies: "" });
  };

  const goNext = () => {
    if (!form.full_name.trim() || !form.phone.trim()) {
      toast.error("Full name and phone are required");
      return;
    }
    setCardNumber(genCardNumber());
    setStep(2);
  };

  const confirm = async () => {
    if (method === "transfer" && (!bank || !ref.trim())) {
      toast.error("Bank and reference required for transfer");
      return;
    }
    setSaving(true);
    try {
      let patientId = picked?.id as string | undefined;
      if (!patientId) {
        const { data, error } = await supabase.from("patients").insert({
          full_name: form.full_name.trim(),
          dob: form.dob || null,
          gender: form.gender,
          phone: form.phone.trim(),
          address: form.address || null,
          allergies: form.allergies || null,
        }).select().single();
        if (error) throw error;
        patientId = data.id;
        await audit("PATIENT_CREATED", "patients", patientId!, { phone: form.phone, name: form.full_name });
      } else {
        await supabase.from("patients").update({
          full_name: form.full_name.trim(),
          dob: form.dob || null,
          gender: form.gender,
          phone: form.phone.trim(),
          address: form.address || null,
          allergies: form.allergies || null,
        }).eq("id", patientId);
      }

      const { data: card, error: cardErr } = await supabase.from("patient_cards")
        .insert({ patient_id: patientId, card_number: cardNumber }).select().single();
      if (cardErr) throw cardErr;

      const token = await nextTokenLabel();
      const raw = localStorage.getItem("clinic_user");
      const u = raw ? JSON.parse(raw) : null;

      const { data: visit, error: vErr } = await supabase.from("visits").insert({
        patient_id: patientId,
        card_id: card.id,
        token_number: token,
        status: "opd_waiting",
        service_sequence: [],
        current_step_index: 0,
      }).select().single();
      if (vErr) throw vErr;

      const { error: payErr } = await supabase.from("payments").insert({
        visit_id: visit.id,
        patient_id: patientId,
        payment_type: "card_fee",
        services_breakdown: [{ name: "Patient Card", fee: cardFee }],
        total_amount: cardFee,
        method,
        bank_name: method === "transfer" ? bank : null,
        transfer_ref: method === "transfer" ? ref : null,
        status: "paid",
        received_by: u?.id ?? null,
        paid_at: new Date().toISOString(),
      });
      if (payErr) throw payErr;

      await audit("REGISTRATION", "visits", visit.id, { token, card: cardNumber, fee: cardFee });
      toast.success(`Registered – ${token} · ${cardNumber}`);
      nav("/reception/queue");
    } catch (e: any) {
      toast.error(e.message || "Failed to register");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Register Patient"
        subtitle={step === 1 ? "Step 1 — Patient details" : "Step 2 — Issue card & payment"} />

      {step === 1 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-4 w-4" /> Find existing patient</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Search name or phone…" value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && search()} />
                <Button variant="secondary" onClick={search}>Search</Button>
              </div>
              <div className="border rounded-md divide-y max-h-72 overflow-auto">
                {results.map((p) => (
                  <button key={p.id}
                    onClick={() => pick(p)}
                    className={`w-full text-left p-3 hover:bg-muted ${picked?.id === p.id ? "bg-muted" : ""}`}>
                    <div className="font-medium">{p.full_name}</div>
                    <div className="text-xs text-muted-foreground">{p.phone} · {p.gender ?? "-"}</div>
                  </button>
                ))}
                {results.length === 0 && <div className="p-4 text-sm text-muted-foreground">No results yet</div>}
              </div>
              <Button variant="outline" className="w-full" onClick={startNew}>
                <UserPlus className="h-4 w-4" /> Or register as new patient
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{picked ? "Update patient details" : "New patient details"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1"><Label>Full name *</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label>Date of birth</Label>
                  <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} /></div>
                <div className="space-y-1"><Label>Gender</Label>
                  <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1"><Label>Phone *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div className="space-y-1"><Label>Address</Label>
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div className="space-y-1"><Label>Allergies</Label>
                <Textarea rows={2} value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} /></div>
              <div className="flex justify-end">
                <Button onClick={goNext}>Continue <ArrowRight className="h-4 w-4" /></Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle>Patient Card Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white p-6 shadow-lg">
                <div className="text-xs uppercase tracking-wider opacity-80">{settings.clinic_name || "Clinic MS"}</div>
                <div className="text-2xl font-bold mt-3">{form.full_name}</div>
                <div className="text-sm opacity-90 mt-1">{form.phone} · {form.gender}</div>
                <div className="mt-6 flex items-end justify-between">
                  <div>
                    <div className="text-xs opacity-80">Card Number</div>
                    <div className="font-mono text-lg">{cardNumber}</div>
                  </div>
                  <Badge variant="secondary">{new Date().getFullYear()}</Badge>
                </div>
              </div>
              <div className="mt-4 flex justify-between text-sm">
                <span className="text-muted-foreground">Card fee</span>
                <span className="font-semibold">{fmtETB(cardFee)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Collect payment</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <RadioGroup value={method} onValueChange={(v) => setMethod(v as any)} className="flex gap-4">
                <label className="flex items-center gap-2"><RadioGroupItem value="cash" /> Cash</label>
                <label className="flex items-center gap-2"><RadioGroupItem value="transfer" /> Bank Transfer</label>
              </RadioGroup>
              {method === "transfer" && (
                <div className="space-y-3">
                  <div className="space-y-1"><Label>Bank</Label>
                    <Select value={bank} onValueChange={setBank}>
                      <SelectTrigger><SelectValue placeholder="Select bank…" /></SelectTrigger>
                      <SelectContent>
                        {banks.length === 0 && <SelectItem value="Other">Other</SelectItem>}
                        {banks.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1"><Label>Reference number</Label>
                    <Input value={ref} onChange={(e) => setRef(e.target.value)} /></div>
                </div>
              )}
              <div className="flex justify-between pt-4 border-t">
                <Button variant="ghost" onClick={() => setStep(1)}>Back</Button>
                <Button onClick={confirm} disabled={saving}>{saving ? "Saving…" : "Confirm & Issue Card"}</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
