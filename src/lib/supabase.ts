import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});

export type Role = "admin" | "reception" | "opd" | "laboratory" | "treatment" | "pharmacy";

export interface ClinicUser {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  is_active?: boolean;
}

export type ServiceType = "lab" | "treatment" | "pharmacy";
