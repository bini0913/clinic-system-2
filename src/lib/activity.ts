import { supabase } from "./supabase";

export type Department = "reception" | "opd" | "laboratory" | "treatment" | "pharmacy" | "admin";

function currentUser() {
  const raw = localStorage.getItem("clinic_user");
  return raw ? JSON.parse(raw) : null;
}

export async function logActivity(params: {
  patient_id: string;
  visit_id?: string | null;
  department: Department;
  action: string;
  details?: any;
}) {
  const u = currentUser();
  try {
    await supabase.from("patient_activity_log").insert({
      patient_id: params.patient_id,
      visit_id: params.visit_id ?? null,
      department: params.department,
      action: params.action,
      performed_by: u?.id ?? null,
      details: params.details ?? null,
    });
    if (params.visit_id) {
      await supabase.from("visits").update({
        last_updated_by: u?.id ?? null,
        last_updated_department: params.department,
      }).eq("id", params.visit_id);
    }
  } catch (e) { /* swallow */ }
}

export async function notify(params: {
  to_role: Department | Department[];
  from_role: Department;
  visit_id?: string | null;
  patient_id?: string | null;
  message: string;
}) {
  const roles = Array.isArray(params.to_role) ? params.to_role : [params.to_role];
  try {
    await supabase.from("notifications").insert(roles.map((r) => ({
      to_role: r,
      from_role: params.from_role,
      visit_id: params.visit_id ?? null,
      patient_id: params.patient_id ?? null,
      message: params.message,
      is_read: false,
    })));
  } catch (e) { /* swallow */ }
}
