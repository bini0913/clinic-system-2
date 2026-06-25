import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/supabase";
import Login from "@/pages/Login";
import Display from "@/pages/Display";
import Landing from "@/pages/Landing";
import Layout from "@/components/Layout";
import ReceptionDashboard from "@/pages/reception/Dashboard";
import ReceptionPatients from "@/pages/reception/Patients";
import ReceptionRegister from "@/pages/reception/Register";
import ReceptionAppointments from "@/pages/reception/Appointments";
import ReceptionQueue from "@/pages/reception/Queue";
import ReceptionPayments from "@/pages/reception/Payments";
import OPDDashboard from "@/pages/opd/Dashboard";
import OPDQueue from "@/pages/opd/Queue";
import OPDVisit from "@/pages/opd/Visit";
import LabDashboard from "@/pages/lab/Dashboard";
import LabVisit from "@/pages/lab/Visit";
import TreatmentDashboard from "@/pages/treatment/Dashboard";
import TreatmentVisit from "@/pages/treatment/Visit";
import PharmacyDashboard from "@/pages/pharmacy/Dashboard";
import PharmacyVisit from "@/pages/pharmacy/Visit";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminServices from "@/pages/admin/Services";
import AdminSettings from "@/pages/admin/Settings";
import AdminAudit from "@/pages/admin/Audit";
import AdminReports from "@/pages/admin/Reports";

function Protected({ roles, children }: { roles: Role[]; children: React.ReactElement }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={`/${user.role}`} replace />;
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  const map: Record<Role, string> = {
    admin: "/admin",
    reception: "/reception",
    opd: "/opd",
    laboratory: "/lab",
    treatment: "/treatment",
    pharmacy: "/pharmacy",
  };
  return <Navigate to={map[user.role]} replace />;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#070C18]" />;
  if (user) {
    const map: Record<Role, string> = {
      admin: "/admin",
      reception: "/reception",
      opd: "/opd",
      laboratory: "/lab",
      treatment: "/treatment",
      pharmacy: "/pharmacy",
    };
    return <Navigate to={map[user.role]} replace />;
  }
  return <Landing />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/display" element={<Display />} />

      <Route element={<Protected roles={["reception"]}><Layout /></Protected>}>
        <Route path="/reception" element={<ReceptionDashboard />} />
        <Route path="/reception/register" element={<ReceptionRegister />} />
        <Route path="/reception/patients" element={<ReceptionPatients />} />
        <Route path="/reception/appointments" element={<ReceptionAppointments />} />
        <Route path="/reception/queue" element={<ReceptionQueue />} />
        <Route path="/reception/payments" element={<ReceptionPayments />} />
      </Route>

      <Route element={<Protected roles={["opd"]}><Layout /></Protected>}>
        <Route path="/opd" element={<OPDDashboard />} />
        <Route path="/opd/queue" element={<OPDQueue />} />
        <Route path="/opd/visit/:id" element={<OPDVisit />} />
      </Route>

      <Route element={<Protected roles={["laboratory"]}><Layout /></Protected>}>
        <Route path="/lab" element={<LabDashboard />} />
        <Route path="/lab/visit/:id" element={<LabVisit />} />
      </Route>

      <Route element={<Protected roles={["treatment"]}><Layout /></Protected>}>
        <Route path="/treatment" element={<TreatmentDashboard />} />
        <Route path="/treatment/visit/:id" element={<TreatmentVisit />} />
      </Route>

      <Route element={<Protected roles={["pharmacy"]}><Layout /></Protected>}>
        <Route path="/pharmacy" element={<PharmacyDashboard />} />
        <Route path="/pharmacy/visit/:id" element={<PharmacyVisit />} />
      </Route>

      <Route element={<Protected roles={["admin"]}><Layout /></Protected>}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/services" element={<AdminServices />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/reports" element={<AdminReports />} />
        <Route path="/admin/audit" element={<AdminAudit />} />
      </Route>

      <Route path="/" element={<RootRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}
