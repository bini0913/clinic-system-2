import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase, type ClinicUser } from "./supabase";
import { toast } from "sonner";

interface AuthCtx {
  user: ClinicUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClinicUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem("clinic_user");
    if (raw) {
      try { setUser(JSON.parse(raw)); } catch {}
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email.trim().toLowerCase())
      .eq("password", password)
      .maybeSingle();
    if (error || !data) {
      toast.error("Invalid email or password");
      return false;
    }
    if (data.is_active === false) {
      toast.error("Account disabled");
      return false;
    }
    const u: ClinicUser = {
      id: data.id, email: data.email, full_name: data.full_name, role: data.role, is_active: data.is_active,
    };
    setUser(u);
    localStorage.setItem("clinic_user", JSON.stringify(u));
    await supabase.from("users").update({ last_active: new Date().toISOString() }).eq("id", u.id);
    await supabase.from("audit_logs").insert({
      user_id: u.id, action: "LOGIN", entity_type: "auth", entity_id: u.id, details: { role: u.role, email: u.email },
    });
    toast.success(`Welcome back, ${u.full_name}`);
    return true;
  };

  const logout = () => {
    if (user) {
      supabase.from("audit_logs").insert({
        user_id: user.id, action: "LOGOUT", entity_type: "auth", entity_id: user.id, details: { email: user.email },
      });
    }
    setUser(null);
    localStorage.removeItem("clinic_user");
  };

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
