import PageHeader from "@/components/PageHeader";
import ServiceQueue from "@/components/ServiceQueue";

export default function PharmacyDashboard() {
  return (
    <div>
      <PageHeader title="Pharmacy Queue" subtitle="Patients ready for dispensing" />
      <ServiceQueue waitingStatus="pharmacy_waiting" basePath="/pharmacy" />
    </div>
  );
}
