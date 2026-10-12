import { ShieldAlert } from "lucide-react";
import { COPY } from "@/lib/admin/copy";

/**
 * The deep band at the top of every Safeguarding screen (admin-ux §6.5; design-system §5.4):
 * "Restricted · Safeguarding officers only", with "Every view is recorded". Marigold on deep passes AA.
 */
export function RestrictedBanner({ label = "Restricted · Safeguarding officers only" }: { label?: string }) {
  return (
    <div role="note" className="mb-6 flex min-h-14 flex-wrap items-center gap-x-4 gap-y-1 rounded-control bg-deep px-5 py-3 text-white focus-marigold">
      <p className="flex items-center gap-2.5 text-[15px] font-extrabold">
        <ShieldAlert aria-hidden className="size-5 shrink-0 text-marigold" strokeWidth={2.5} />
        {label}
      </p>
      <p className="font-grotesk text-[13px] font-medium text-white/80">{COPY["ribbon.restricted"]}</p>
    </div>
  );
}
