import { NoAccess } from "@/components/admin/shell/NoAccess";
import { askAdminName } from "@/lib/server/dal/_shared";

// requireStaff() calls notFound() when the person lacks every listed permission, and record pages do
// the same for records that do not exist: both render this friendly refusal inside the shell (PLAN
// D84). Its wording covers "not here, or not open to your role", so nothing leaks either way.
export default async function DeskNotFound() {
  const askName = await askAdminName();
  return <NoAccess askName={askName} />;
}
