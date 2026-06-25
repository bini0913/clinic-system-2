import PageHeader from "@/components/PageHeader";
import ServiceQueue from "@/components/ServiceQueue";

export default function LabDashboard() {
  return (
    <div>
      <PageHeader title="Laboratory Queue" subtitle="Patients sent for lab tests" />
      <ServiceQueue waitingStatus="lab_waiting" basePath="/lab" />
    </div>
  );
}
