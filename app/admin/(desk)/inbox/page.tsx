import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Inbox" };

/** Desktop detail pane before anything is picked (phones show only the list). */
export default function InboxHome() {
  return <EmptyState art="hands" title="Pick something from the list" body="It opens here, beside the list, so you can keep going one after another." className="rounded-[26px] bg-white" />;
}
