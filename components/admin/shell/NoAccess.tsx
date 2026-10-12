import { HandDoodle } from "@/components/art/Hands";
import { Button } from "@/components/ui/Button";
import { COPY, t } from "@/lib/admin/copy";

/**
 * The friendly refusal (admin-ux §5.5 rule 6; PLAN D84): rendered by `(desk)/not-found.tsx` whenever
 * requireStaff() finds no matching permission, and for records that do not exist. It never says
 * which of the two it was (no existence leak), and names a super admin to ask.
 */
export function NoAccess({ askName }: { askName?: string | null }) {
  return (
    <section aria-labelledby="no-access-title" className="mx-auto flex max-w-[640px] flex-col items-center rounded-control bg-white px-6 py-14 text-center shadow-soft">
      <HandDoodle className="w-[96px]" />
      <h1 id="no-access-title" className="mt-6 text-balance text-[24px] font-extrabold leading-tight text-ink md:text-[28px]">
        {COPY["access.notAllowedTitle"]}
      </h1>
      <p className="mt-3 max-w-[460px] text-[16px] leading-relaxed text-body">{t("access.notAllowed", { name: askName || COPY["access.askFallback"] })}</p>
      <div className="mt-8">
        <Button href="/admin" variant="forest" size="sm" icon="arrow-right">
          Back to Today
        </Button>
      </div>
    </section>
  );
}
