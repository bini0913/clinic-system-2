import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Droplet, Phone, User, Heart, Pill, FileText } from "lucide-react";
import { fmtDate } from "@/lib/helpers";

function ageFromDob(dob?: string | null) {
  if (!dob) return null;
  const b = new Date(dob);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
  return a;
}

type Vitals = {
  temp?: string; bp_systolic?: string; bp_diastolic?: string;
  heart_rate?: string; respiratory_rate?: string; spo2?: string;
  weight?: string; height?: string; bmi?: string;
};

export default function PatientBanner({
  patient, token, extra, vitals, orderedServices,
}: {
  patient: any;
  token?: string;
  extra?: React.ReactNode;
  vitals?: Vitals | null;
  orderedServices?: { type: string; service_name: string }[];
}) {
  const age = ageFromDob(patient?.dob);
  return (
    <Card className="mb-4 border-l-4 border-l-sky-500">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-lg">{patient?.full_name}</span>
              {token && <Badge variant="secondary" className="font-mono">{token}</Badge>}
              {patient?.blood_type && (
                <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100">
                  <Droplet className="h-3 w-3 mr-1" />{patient.blood_type}
                </Badge>
              )}
              {patient?.gender && <Badge variant="outline">{patient.gender}</Badge>}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {patient?.dob && <span>DOB {fmtDate(patient.dob)} {age != null && `(${age}y)`}</span>}
              {patient?.phone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
              {patient?.emergency_contact_name && (
                <span className="inline-flex items-center gap-1">
                  Emergency: {patient.emergency_contact_name}
                  {patient.emergency_contact_phone ? ` (${patient.emergency_contact_phone})` : ""}
                  {patient.emergency_contact_relationship ? ` · ${patient.emergency_contact_relationship}` : ""}
                </span>
              )}
            </div>
          </div>
          {extra}
        </div>

        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          {patient?.allergies && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 text-amber-900">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div><b>Allergies:</b> {patient.allergies}</div>
            </div>
          )}
          {patient?.chronic_conditions && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-orange-50 text-orange-900">
              <Heart className="h-4 w-4 mt-0.5 shrink-0" />
              <div><b>Chronic:</b> {patient.chronic_conditions}</div>
            </div>
          )}
          {patient?.current_medications && (
            <div className="flex items-start gap-2 p-2 rounded-md bg-indigo-50 text-indigo-900">
              <Pill className="h-4 w-4 mt-0.5 shrink-0" />
              <div><b>Current meds:</b> {patient.current_medications}</div>
            </div>
          )}
        </div>

        {orderedServices && orderedServices.length > 0 && (
          <div className="text-xs">
            <span className="text-muted-foreground inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Ordered: </span>
            {orderedServices.map((s, i) => (
              <Badge key={i} variant="outline" className="ml-1">{s.service_name}</Badge>
            ))}
          </div>
        )}

        {vitals && Object.values(vitals).some(Boolean) && (
          <div className="text-xs flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t">
            {vitals.temp && <span>Temp <b>{vitals.temp}°C</b></span>}
            {(vitals.bp_systolic || vitals.bp_diastolic) && <span>BP <b>{vitals.bp_systolic}/{vitals.bp_diastolic}</b></span>}
            {vitals.heart_rate && <span>HR <b>{vitals.heart_rate}</b></span>}
            {vitals.respiratory_rate && <span>RR <b>{vitals.respiratory_rate}</b></span>}
            {vitals.spo2 && <span>SpO₂ <b>{vitals.spo2}%</b></span>}
            {vitals.weight && <span>Wt <b>{vitals.weight}kg</b></span>}
            {vitals.height && <span>Ht <b>{vitals.height}cm</b></span>}
            {vitals.bmi && <span>BMI <b>{vitals.bmi}</b></span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
