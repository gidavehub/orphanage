import { PencilLine } from "lucide-react";

export type ReviewGroup = { step: number; title: string; rows: Array<{ label: string; value: string | null | undefined }> };

/**
 * The read-only "Review and send" summary (public-pages §3.6 step 4): one card per step with an
 * Edit button that jumps back to it. Empty answers read "Not given".
 */
export function ReviewSummary({ groups, onEdit }: { groups: ReviewGroup[]; onEdit: (step: number) => void }) {
  return (
    <div className="grid gap-4">
      {groups.map((g) => (
        <section key={g.step} aria-label={g.title} className="rounded-control border border-line bg-cream-2 p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[17px] font-extrabold text-ink">{g.title}</h3>
            <button
              type="button"
              onClick={() => onEdit(g.step)}
              className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[14px] font-bold text-forest transition-colors hover:bg-mint"
            >
              <PencilLine aria-hidden className="size-4" strokeWidth={2.25} />
              Edit<span className="sr-only"> {g.title.toLowerCase()}</span>
            </button>
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
            {g.rows.map((r) => (
              <div key={r.label} className="contents">
                <dt className="font-grotesk text-[13px] font-semibold uppercase tracking-[0.04em] text-body sm:pt-0.5">{r.label}</dt>
                <dd className="whitespace-pre-line text-[15px] leading-relaxed text-ink [overflow-wrap:anywhere] max-sm:-mt-2">
                  {r.value && r.value.trim() ? r.value : <span className="text-body">Not given</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
