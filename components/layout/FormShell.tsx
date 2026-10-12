import { cn } from "@/lib/cn";

export type FormShellProps = {
  /** The form (max-w-form, 760px). */
  form: React.ReactNode;
  /** Help card, "What happens next" Timeline and contact card; sticky beside the form from lg. */
  aside?: React.ReactNode;
  className?: string;
};

/**
 * The two-column frame for every public form (design-system §3.1). On phones the aside follows the
 * form; the emergency notice lives in PageHero.notice so it stays above the fold.
 * Put it in a white Section with `cv={false}`.
 */
export function FormShell({ form, aside, className }: FormShellProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-10 lg:gap-16", aside ? "lg:grid-cols-[minmax(0,1fr)_360px]" : undefined, className)}>
      <div className="w-full min-w-0 max-w-form">{form}</div>
      {aside ? <aside className="grid gap-5 self-start lg:sticky lg:top-28">{aside}</aside> : null}
    </div>
  );
}

export type FormAsideCardProps = {
  title: string;
  /** `cream` (default) for help, `white` for contact details, `deep` for safeguarding reminders. */
  tone?: "cream" | "white" | "deep";
  headingLevel?: 2 | 3;
  children: React.ReactNode;
  className?: string;
};

/** A card in the FormShell aside (help, what happens next, contact). */
export function FormAsideCard({ title, tone = "cream", headingLevel = 2, children, className }: FormAsideCardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <section
      className={cn(
        "rounded-control p-6",
        tone === "cream" && "bg-cream text-ink",
        tone === "white" && "bg-white text-ink shadow-soft",
        tone === "deep" && "bg-deep text-white focus-marigold",
        className,
      )}
    >
      <Heading className="text-[18px] font-extrabold leading-snug">{title}</Heading>
      <span aria-hidden className="mt-2 block h-[2px] w-10 bg-marigold" />
      <div className={cn("mt-4 text-[15px] leading-relaxed", tone === "deep" ? "text-white/85" : "text-body")}>{children}</div>
    </section>
  );
}
