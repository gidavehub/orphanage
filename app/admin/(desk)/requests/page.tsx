import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Requests" };

export default function RequestsHome() {
  return <EmptyState art="hands" title="Pick a request from the list" body="It opens here with its stage, notes and everything you need to move it forward." className="rounded-[26px] bg-white" />;
}
