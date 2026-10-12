import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Report requests" };

export default function ReportRequestsHome() {
  return <EmptyState art="hands" title="Pick a request from the list" body="It opens here with who asked, why, and the steps to send the report." className="rounded-[26px] bg-white" />;
}
