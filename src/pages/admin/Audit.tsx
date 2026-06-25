import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { fmtDateTime } from "@/lib/helpers";

export default function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("audit_logs")
      .select("*,users(email,full_name)")
      .order("created_at", { ascending: false }).limit(300)
      .then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Recent system activity (latest 300)" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>When</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtDateTime(r.created_at)}</TableCell>
                <TableCell>{r.users?.email ?? r.user_id}</TableCell>
                <TableCell><Badge variant="secondary">{r.action}</Badge></TableCell>
                <TableCell>{r.entity_type}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-md truncate">{r.details ? JSON.stringify(r.details) : "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
