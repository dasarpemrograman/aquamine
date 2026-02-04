import { requireRole } from "@/lib/auth";
import AdminClientPage from "./AdminClientPage";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await requireRole("superadmin");
  return <AdminClientPage />;
}
