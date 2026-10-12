import { AdminPageSkeleton } from "@/components/admin/shell/AdminShellSkeleton";
import { LoadingRegion } from "@/components/ui/Skeleton";

// The Suspense boundary every desk page's session read sits under (PLAN D2, next16 §3). Cream
// skeleton cards in the shape of a page, never a spinner (admin-ux §9.2).
export default function DeskLoading() {
  return (
    <LoadingRegion label="Loading…">
      <AdminPageSkeleton />
    </LoadingRegion>
  );
}
