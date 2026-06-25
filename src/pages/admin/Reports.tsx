import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtETB } from "@/lib/helpers";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { format, subDays } from "date-fns";

export default function Reports() {
  const [data, setData] = useState<any[]>([]);
  const [totals, setTotals] = useState({ visits: 0, revenue: 0 });

  useEffect(() => {
    (async () => {
      const since = subDays(new Date(), 29).toISOString();
      const [{ data: pays }, { data: visits }] = await Promise.all([
        supabase.from("payments").select("total_amount,paid_at").eq("status", "paid").gte("paid_at", since),
        supabase.from("visits").select("id,created_at").gte("created_at", since),
      ]);
      const days = Array.from({ length: 30 }).map((_, i) => {
        const d = subDays(new Date(), 29 - i);
        const k = format(d, "MMM d");
        const rev = (pays ?? []).filter((p: any) => p.paid_at && format(new Date(p.paid_at), "MMM d") === k).reduce((a: number, p: any) => a + Number(p.total_amount), 0);
        const v = (visits ?? []).filter((x: any) => format(new Date(x.created_at), "MMM d") === k).length;
        return { day: k, revenue: rev, visits: v };
      });
      setData(days);
      setTotals({
        visits: visits?.length ?? 0,
        revenue: (pays ?? []).reduce((a: number, p: any) => a + Number(p.total_amount), 0),
      });
    })();
  }, []);

  return (
    <div>
      <PageHeader title="Reports" subtitle="Last 30 days overview" />
      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Card><CardContent className="p-5"><div className="text-muted-foreground text-xs">Visits (30d)</div><div className="text-3xl font-semibold mt-1">{totals.visits}</div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="text-muted-foreground text-xs">Revenue (30d)</div><div className="text-3xl font-semibold mt-1">{fmtETB(totals.revenue)}</div></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Daily trend</CardTitle></CardHeader>
        <CardContent className="h-96">
          <ResponsiveContainer><LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#0EA5E9" strokeWidth={2} />
            <Line yAxisId="right" type="monotone" dataKey="visits" stroke="#10B981" strokeWidth={2} />
          </LineChart></ResponsiveContainer>
        </CardContent></Card>
    </div>
  );
}
