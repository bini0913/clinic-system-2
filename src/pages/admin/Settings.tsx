import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useSettings } from "@/lib/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { audit } from "@/lib/helpers";
import { Trash2, Plus } from "lucide-react";

const KNOWN = ["clinic_name", "address", "phone", "email", "card_fee", "receipt_footer"];

export default function Settings() {
  const { refresh } = useSettings();
  const [rows, setRows] = useState<Record<string, string>>({});
  const [banks, setBanks] = useState<string[]>([]);
  const [newBank, setNewBank] = useState("");

  const load = async () => {
    const { data } = await supabase.from("clinic_settings").select("*");
    const obj: Record<string, string> = {};
    (data ?? []).forEach((r: any) => { obj[r.key] = r.value ?? ""; });
    setRows(obj);
    try { setBanks(JSON.parse(obj.banks || "[]")); } catch { setBanks([]); }
  };
  useEffect(() => { load(); }, []);

  const upsertKey = async (key: string, value: string) => {
    // Try update; if 0 rows affected, insert
    const { data } = await supabase.from("clinic_settings").update({ value }).eq("key", key).select();
    if (!data || data.length === 0) {
      await supabase.from("clinic_settings").insert({ key, value });
    }
  };

  const save = async () => {
    for (const k of KNOWN) await upsertKey(k, rows[k] ?? "");
    await upsertKey("banks", JSON.stringify(banks));
    await audit("SETTINGS_UPDATED", "clinic_settings");
    await refresh();
    toast.success("Settings saved");
  };

  const set = (k: string, v: string) => setRows((p) => ({ ...p, [k]: v }));

  return (
    <div>
      <PageHeader title="Clinic Settings" subtitle="Branding, receipt details and accepted banks" />
      <div className="grid lg:grid-cols-2 gap-4">
        <Card><CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1"><Label>Clinic name</Label><Input value={rows.clinic_name || ""} onChange={(e) => set("clinic_name", e.target.value)} /></div>
            <div className="space-y-1"><Label>Address</Label><Textarea rows={2} value={rows.address || ""} onChange={(e) => set("address", e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label>Phone</Label><Input value={rows.phone || ""} onChange={(e) => set("phone", e.target.value)} /></div>
              <div className="space-y-1"><Label>Email</Label><Input type="email" value={rows.email || ""} onChange={(e) => set("email", e.target.value)} /></div>
            </div>
            <div className="space-y-1"><Label>Card fee (ETB)</Label><Input type="number" value={rows.card_fee || ""} onChange={(e) => set("card_fee", e.target.value)} /></div>
            <div className="space-y-1"><Label>Receipt footer</Label><Textarea rows={2} value={rows.receipt_footer || ""} onChange={(e) => set("receipt_footer", e.target.value)} /></div>
          </CardContent></Card>

        <Card><CardHeader><CardTitle>Accepted Banks</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input placeholder="Add bank name…" value={newBank} onChange={(e) => setNewBank(e.target.value)} />
              <Button onClick={() => { if (newBank.trim()) { setBanks([...banks, newBank.trim()]); setNewBank(""); } }}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            <div className="space-y-2">
              {banks.map((b, i) => (
                <div key={i} className="flex items-center justify-between border rounded p-2 text-sm">
                  <span>{b}</span>
                  <Button variant="ghost" size="icon" onClick={() => setBanks(banks.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {banks.length === 0 && <div className="text-sm text-muted-foreground">No banks configured</div>}
            </div>
          </CardContent></Card>
      </div>
      <div className="flex justify-end mt-4"><Button onClick={save}>Save All</Button></div>
    </div>
  );
}
