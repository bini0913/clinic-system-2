import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { audit, fmtETB } from "@/lib/helpers";
import { toast } from "sonner";
import { Plus } from "lucide-react";

const CATS = ["consultation", "lab", "treatment", "pharmacy", "other"];

export default function AdminServices() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", category: "lab", default_fee: "" });

  const load = async () => {
    const { data } = await supabase.from("service_catalogue").select("*").order("category").order("name");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!f.name || !f.default_fee) { toast.error("Name and fee required"); return; }
    const { error } = await supabase.from("service_catalogue").insert({
      name: f.name, category: f.category, default_fee: Number(f.default_fee), is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    await audit("SERVICE_CREATED", "service_catalogue", undefined, f);
    toast.success("Service added");
    setOpen(false); setF({ name: "", category: "lab", default_fee: "" }); load();
  };

  const toggle = async (s: any) => {
    await supabase.from("service_catalogue").update({ is_active: !s.is_active }).eq("id", s.id);
    load();
  };

  const updatePrice = async (s: any, p: number) => {
    await supabase.from("service_catalogue").update({ default_fee: p }).eq("id", s.id);
    await audit("SERVICE_PRICE_UPDATED", "service_catalogue", s.id, { from: s.default_fee, to: p });
    load();
  };

  return (
    <div>
      <PageHeader title="Service Catalogue" subtitle="Tests, treatments, and items with default pricing"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add Service</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New service</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Category</Label>
                  <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1"><Label>Default fee (ETB)</Label><Input type="number" value={f.default_fee} onChange={(e) => setF({ ...f, default_fee: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Service</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Fee</TableHead><TableHead>Active</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="secondary">{s.category}</Badge></TableCell>
                <TableCell className="text-right">
                  <Input type="number" defaultValue={s.default_fee} className="h-8 w-28 text-right ml-auto"
                    onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(s.default_fee)) updatePrice(s, v); }} />
                  <div className="text-xs text-muted-foreground mt-1">{fmtETB(s.default_fee)}</div>
                </TableCell>
                <TableCell><Switch checked={!!s.is_active} onCheckedChange={() => toggle(s)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
