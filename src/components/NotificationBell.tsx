import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDistanceToNow } from "date-fns";

const roleMap: Record<string, string> = {
  reception: "reception", opd: "opd", laboratory: "laboratory",
  treatment: "treatment", pharmacy: "pharmacy", admin: "admin",
};

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("*,patients(full_name)")
      .eq("to_role", roleMap[user.role] || user.role)
      .order("created_at", { ascending: false })
      .limit(10);
    setItems(data ?? []);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notifs")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();
    const i = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); clearInterval(i); };
  }, [user?.role]);

  const unread = items.filter((n) => !n.is_read).length;

  const markAll = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true })
      .eq("to_role", roleMap[user.role] || user.role).eq("is_read", false);
    load();
  };

  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    load();
  };

  if (!user) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-red-500 text-[10px] text-white flex items-center justify-center">
              {unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <div className="font-semibold text-sm">Notifications</div>
          {unread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAll}>Mark all read</Button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto divide-y">
          {items.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No notifications</div>}
          {items.map((n) => (
            <div key={n.id} className={`p-3 text-sm ${n.is_read ? "opacity-60" : "bg-sky-50/40"}`} onClick={() => !n.is_read && markOne(n.id)}>
              <div className={n.is_read ? "" : "font-medium"}>{n.message}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                <span>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                {n.patient_id && (
                  <Link to={`/patient/${n.patient_id}`} className="text-sky-600 hover:underline" onClick={() => setOpen(false)}>
                    View patient →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
