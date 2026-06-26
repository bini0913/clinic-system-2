import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PatientLink({
  id, name, className, children,
}: { id?: string | null; name?: string | null; className?: string; children?: React.ReactNode }) {
  if (!id) return <span className={className}>{children ?? name ?? "-"}</span>;
  return (
    <Link
      to={`/patient/${id}`}
      className={cn("font-medium text-sky-600 hover:text-sky-700 hover:underline underline-offset-2", className)}
    >
      {children ?? name ?? "-"}
    </Link>
  );
}
