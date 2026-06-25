import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { useSettings } from "@/lib/settings";
import type { Role } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, Users, ListOrdered, CreditCard, Stethoscope, FlaskConical,
  Activity, Pill, Settings, FileText, ShieldCheck, BarChart3, LogOut, Menu, Tv,
  UserPlus, CalendarDays,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV: Record<Role, { to: string; label: string; icon: any }[]> = {
  reception: [
    { to: "/reception", label: "Dashboard", icon: LayoutDashboard },
    { to: "/reception/register", label: "Register Patient", icon: UserPlus },
    { to: "/reception/patients", label: "Patients", icon: Users },
    { to: "/reception/appointments", label: "Appointments", icon: CalendarDays },
    { to: "/reception/queue", label: "Live Queue", icon: ListOrdered },
    { to: "/reception/payments", label: "Payments", icon: CreditCard },
  ],
  opd: [
    { to: "/opd", label: "Dashboard", icon: LayoutDashboard },
    { to: "/opd/queue", label: "Patient Queue", icon: Stethoscope },
  ],
  laboratory: [
    { to: "/lab", label: "Lab Queue", icon: FlaskConical },
  ],
  treatment: [
    { to: "/treatment", label: "Treatment Queue", icon: Activity },
  ],
  pharmacy: [
    { to: "/pharmacy", label: "Pharmacy Queue", icon: Pill },
  ],
  admin: [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/services", label: "Service Catalogue", icon: FileText },
    { to: "/admin/settings", label: "Clinic Settings", icon: Settings },
    { to: "/admin/reports", label: "Reports", icon: BarChart3 },
    { to: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  ],
};

export default function Layout() {
  const { user, logout } = useAuth();
  const { settings } = useSettings();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  if (!user) return null;
  const items = NAV[user.role];
  const clinicName = settings.clinic_name || "Clinic MS";

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform md:relative md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="p-5 border-b border-sidebar-border">
          <div className="text-lg font-semibold truncate">{clinicName}</div>
          <div className="text-xs opacity-70 mt-1 capitalize">{user.role} Portal</div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === `/${user.role === "laboratory" ? "lab" : user.role}`}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50",
                )
              }
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <a
            href="/display"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs px-3 py-2 rounded-md hover:bg-sidebar-accent/50"
          >
            <Tv className="h-3.5 w-3.5" /> Display Screen
          </a>
          <div className="px-3 py-2 text-xs">
            <div className="font-medium truncate">{user.full_name}</div>
            <div className="opacity-70 truncate">{user.email}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={() => { logout(); nav("/login"); }}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between p-3 border-b">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            <Menu />
          </Button>
          <div className="font-semibold truncate">{clinicName}</div>
          <div className="w-9" />
        </header>
        <main className="flex-1 p-4 md:p-6 overflow-x-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
