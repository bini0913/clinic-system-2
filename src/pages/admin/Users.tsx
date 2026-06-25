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
import { audit } from "@/lib/helpers";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";

const ROLES = ["admin", "reception", "opd", "laboratory", "treatment", "pharmacy"];

export default function AdminUsers() {
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ email: "", password: "", full_name: "", role: "reception" });

  const load = async () => {
    const { data } = await supabase.from("users").select("*").order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!f.email || !f.password || !f.full_name) { toast.error("All fields required"); return; }
    const { error } = await supabase.from("users").insert({ ...f, email: f.email.toLowerCase(), is_active: true });
    if (error) { toast.error(error.message); return; }
    await audit("USER_CREATED", "users", undefined, { email: f.email, role: f.role });
    toast.success("User created");
    setOpen(false); setF({ email: "", password: "", full_name: "", role: "reception" });
    load();
  };

  const toggleActive = async (u: any) => {
    await supabase.from("users").update({ is_active: !u.is_active }).eq("id", u.id);
    await audit(u.is_active ? "USER_DISABLED" : "USER_ENABLED", "users", u.id);
    load();
  };

  return (
    <div>
      <PageHeader title="Users" subtitle="Manage staff accounts"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><UserPlus className="h-4 w-4" /> Add User</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New user</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1"><Label>Full name</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
                <div className="space-y-1"><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
                <div className="space-y-1"><Label>Password</Label><Input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
                <div className="space-y-1"><Label>Role</Label>
                  <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={create}>Create</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        } />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Active</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.full_name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                <TableCell><Badge variant={u.is_active !== false ? "default" : "destructive"}>{u.is_active !== false ? "active" : "disabled"}</Badge></TableCell>
                <TableCell className="text-right"><Switch checked={u.is_active !== false} onCheckedChange={() => toggleActive(u)} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
