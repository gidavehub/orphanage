import { Download } from "lucide-react";

/**
 * "Download" for a list (PLAN D102): a spreadsheet without contact details, and, for people allowed,
 * one with names and emails (asks you to confirm it's you when your sign-in is older than 30 minutes).
 * Plain links: the route answers with a CSV attachment, or a redirect to /admin/confirm.
 */
export function ExportLinks({ dataset, label, withContacts }: { dataset: string; label: string; withContacts: boolean }) {
  const base = `/admin/export/${dataset}`;
  return (
    <details className="group relative">
      <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink hover:border-forest [&::-webkit-details-marker]:hidden">
        <Download aria-hidden className="size-4" /> Download
      </summary>
      <div className="absolute right-0 z-20 mt-2 grid w-[min(300px,calc(100vw-32px))] gap-1 rounded-2xl bg-white p-2 shadow-card">
        <a href={base} className="rounded-xl px-3 py-2.5 hover:bg-cream">
          <span className="block text-[14.5px] font-bold text-ink">{label}</span>
          <span className="block text-[13px] text-body">A spreadsheet without names or contact details.</span>
        </a>
        {withContacts ? (
          <a href={`${base}?contact=1`} className="rounded-xl px-3 py-2.5 hover:bg-cream">
            <span className="block text-[14.5px] font-bold text-ink">{label}, with names and emails</span>
            <span className="block text-[13px] text-body">Personal details. You may be asked to confirm it’s you.</span>
          </a>
        ) : null}
      </div>
    </details>
  );
}
