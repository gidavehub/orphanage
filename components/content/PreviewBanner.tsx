import { draftMode } from "next/headers";
import Link from "next/link";
import { Eye } from "lucide-react";

/**
 * The one Draft Mode banner (PLAN D62; content-model §4.6): a slim marigold bar at the top of every
 * public page while the visitor holds the preview cookie (staff only; issued by the studio's preview
 * route after requireStaff). Reads `draftMode()` outside any cache scope, so the site layout renders
 * it inside `<Suspense fallback={null}>`. `exitAction` is lib/content/actions.ts `exitPreview`,
 * passed in by the layout (components never import the content actions module themselves).
 */
export async function PreviewBanner({ exitAction }: { exitAction: () => Promise<void> }) {
  const { isEnabled } = await draftMode();
  if (!isEnabled) return null;
  return (
    <div role="region" aria-label="Preview" className="relative z-[60] bg-marigold text-night focus-forest">
      <div className="wrap-wide flex min-h-11 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
        <p className="flex items-center gap-2 text-[14px] font-bold leading-snug">
          <Eye aria-hidden className="size-4 shrink-0" strokeWidth={2.5} />
          You&rsquo;re previewing changes that aren&rsquo;t live yet.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/website/changes"
            target="_top"
            className="inline-flex h-9 items-center rounded-full px-4 text-[14px] font-bold underline-offset-4 hover:underline"
          >
            Review and put live
          </Link>
          <form action={exitAction}>
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-full bg-night px-4 text-[14px] font-bold text-white transition-colors hover:bg-forest"
            >
              Exit preview
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
