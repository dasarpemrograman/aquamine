import { requireRole } from "@/lib/auth";
import AdminClientPage from "./AdminClientPage";

export default async function AdminPage() {
  await requireRole("superadmin");
  return <AdminClientPage />;
}
