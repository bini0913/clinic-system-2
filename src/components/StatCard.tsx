import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function StatCard({
  label, value, icon: Icon, tone = "primary",
}: { label: string; value: string | number; icon: any; tone?: "primary" | "success" | "warning" | "destructive" | "muted" }) {
  const tones: Record<string, string> = {
    primary: "bg-sky-100 text-sky-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
    destructive: "bg-rose-100 text-rose-700",
    muted: "bg-slate-100 text-slate-700",
  };
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={cn("h-12 w-12 rounded-xl flex items-center justify-center", tones[tone])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold mt-0.5">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
