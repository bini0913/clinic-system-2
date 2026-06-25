import { supabase } from "./supabase";
import { format } from "date-fns";

export const fmtETB = (n: number | null | undefined) =>
  `ETB ${Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fmtDate = (d: string | Date | null | undefined, p = "PP") =>
  d ? format(new Date(d), p) : "-";

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? format(new Date(d), "PP p") : "-";

export const tokenLabel = (n: number) => `T-${String(n).padStart(3, "0")}`;

export function genCardNumber() {
  const y = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CRD-${y}-${rand}`;
}

export async function nextTokenLabel() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("visits")
    .select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  return tokenLabel((count ?? 0) + 1);
}

// Back-compat
export const nextTokenNumber = async () => {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("visits").select("id", { count: "exact", head: true })
    .gte("created_at", start.toISOString());
  return (count ?? 0) + 1;
};

export async function audit(action: string, entityType: string, entityId?: string, details?: any) {
  const raw = localStorage.getItem("clinic_user");
  if (!raw) return;
  const u = JSON.parse(raw);
  await supabase.from("audit_logs").insert({
    user_id: u.id, action, entity_type: entityType, entity_id: entityId, details,
  });
}

/** Advance visit to next step in service_sequence, or complete it. */
export async function advance(visit: any) {
  const seq: string[] = visit.service_sequence || [];
  const nextIdx = (visit.current_step_index ?? 0) + 1;
  if (nextIdx < seq.length) {
    await supabase.from("visits").update({
      status: `${seq[nextIdx]}_waiting`,
      current_step_index: nextIdx,
    }).eq("id", visit.id);
  } else {
    await supabase.from("visits").update({
      status: "completed",
      completed_at: new Date().toISOString(),
    }).eq("id", visit.id);
  }
}
