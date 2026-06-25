import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { useRealtime } from "@/lib/useRealtime";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { fmtDateTime } from "@/lib/helpers";

export default function OPDQueue() {
  const [rows, setRows] = useState<any[]>([]);
  const load = async () => {
    const { data } = await supabase.from("visits")
      .select("id,token_number,status,created_at,patients(full_name,phone,dob,gender),patient_cards(card_number)")
      .eq("status", "opd_waiting")
      .order("created_at");
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);
  useRealtime(["visits"], load);

  return (
    <div>
      <PageHeader title="OPD Queue" subtitle="Patients waiting for consultation" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Token</TableHead><TableHead>Patient</TableHead><TableHead>Card</TableHead>
            <TableHead>Status</TableHead><TableHead>Waiting since</TableHead><TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-mono">{v.token_number}</TableCell>
                <TableCell>
                  <div className="font-medium">{v.patients?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{v.patients?.phone}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{v.patient_cards?.card_number}</TableCell>
                <TableCell><Badge variant="secondary">{v.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{fmtDateTime(v.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button size="sm" asChild><Link to={`/opd/visit/${v.id}`}>Open</Link></Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No patients waiting</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
