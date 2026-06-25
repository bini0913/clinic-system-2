import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { fmtDate } from "@/lib/helpers";
import { UserPlus } from "lucide-react";

export default function Patients() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");

  const load = async () => {
    let query = supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(200);
    if (q.trim()) query = query.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`);
    const { data } = await query;
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [q]);

  return (
    <div>
      <PageHeader title="Patients" subtitle="Search and manage patient records"
        action={<Button asChild><Link to="/reception/register"><UserPlus className="h-4 w-4" /> Register Patient</Link></Button>} />
      <Card className="mb-4"><CardContent className="p-4">
        <Input placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </CardContent></Card>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>DOB</TableHead>
            <TableHead>Gender</TableHead><TableHead>Address</TableHead><TableHead>Registered</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name}</TableCell>
                <TableCell>{p.phone}</TableCell>
                <TableCell>{p.dob ? fmtDate(p.dob) : "-"}</TableCell>
                <TableCell>{p.gender ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{p.address ?? "-"}</TableCell>
                <TableCell>{fmtDate(p.created_at)}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No patients</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
