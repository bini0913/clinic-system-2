export type VisitStatus =
  | "opd_waiting" | "in_opd" | "pending_payment"
  | "lab_waiting" | "in_lab" | "lab_result_pending"
  | "treatment_waiting" | "in_treatment"
  | "pharmacy_waiting" | "in_pharmacy"
  | "completed";

const LABELS: Record<string, string> = {
  opd_waiting: "OPD Waiting",
  in_opd: "In OPD",
  pending_payment: "Payment Pending",
  lab_waiting: "Lab Waiting",
  in_lab: "In Lab",
  lab_result_pending: "Lab Result Pending",
  treatment_waiting: "Treatment Waiting",
  in_treatment: "In Treatment",
  pharmacy_waiting: "Pharmacy Waiting",
  in_pharmacy: "In Pharmacy",
  completed: "Completed",
};

// tailwind class strings (light bg / readable text)
const COLORS: Record<string, string> = {
  opd_waiting: "bg-sky-100 text-sky-800 border-sky-200",
  in_opd: "bg-indigo-100 text-indigo-800 border-indigo-200",
  pending_payment: "bg-orange-100 text-orange-800 border-orange-200",
  lab_waiting: "bg-yellow-100 text-yellow-800 border-yellow-200",
  in_lab: "bg-yellow-100 text-yellow-800 border-yellow-200",
  lab_result_pending: "bg-amber-100 text-amber-800 border-amber-200",
  treatment_waiting: "bg-purple-100 text-purple-800 border-purple-200",
  in_treatment: "bg-purple-100 text-purple-800 border-purple-200",
  pharmacy_waiting: "bg-teal-100 text-teal-800 border-teal-200",
  in_pharmacy: "bg-teal-100 text-teal-800 border-teal-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export function statusLabel(s?: string | null): string {
  if (!s) return "-";
  return LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statusColor(s?: string | null): string {
  if (!s) return "bg-slate-100 text-slate-700 border-slate-200";
  return COLORS[s] ?? "bg-slate-100 text-slate-700 border-slate-200";
}

// ordered journey stages used by progress tracker
export const STAGES = [
  { key: "registered", label: "Registered" },
  { key: "opd", label: "OPD" },
  { key: "lab", label: "Lab" },
  { key: "lab_review", label: "Lab Review" },
  { key: "treatment", label: "Treatment" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "completed", label: "Completed" },
] as const;

/** Returns the index of the currently-active stage for a given visit status. */
export function activeStageIndex(status?: string | null): number {
  switch (status) {
    case "opd_waiting":
    case "in_opd":
      return 1;
    case "pending_payment":
      return 1; // still around OPD waiting on payment to move
    case "lab_waiting":
    case "in_lab":
      return 2;
    case "lab_result_pending":
      return 3;
    case "treatment_waiting":
    case "in_treatment":
      return 4;
    case "pharmacy_waiting":
    case "in_pharmacy":
      return 5;
    case "completed":
      return 6;
    default:
      return 0;
  }
}
