import PageHeader from "@/components/PageHeader";
import ServiceQueue from "@/components/ServiceQueue";

export default function TreatmentDashboard() {
  return (
    <div>
      <PageHeader title="Treatment Queue" subtitle="Patients sent for treatment" />
      <ServiceQueue waitingStatus="treatment_waiting" basePath="/treatment" />
    </div>
  );
}
