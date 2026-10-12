"use client";

import { useEffect, useState, useTransition } from "react";
import { Copy, Eye } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/Toast";
import { COPY } from "@/lib/admin/copy";
import { cn } from "@/lib/cn";

const REVEAL_MS = 60_000;

export type MaskedProps = {
  /** The masked text the server sent ("f•••@gmail.com", "+220 ••• ••34"). Never the real value. */
  masked: string;
  kind: "phone" | "email" | "text";
  /** What the value is ("Phone", "Email"), for the button's accessible name. */
  label: string;
  /** False for viewers: no Show button (admin-ux §5.1). */
  canReveal: boolean;
  /**
   * A Server Action passed in by the page: it checks permission, writes a `sensitive` audit entry
   * (field.reveal) and returns the real value, or null when not allowed.
   */
  onReveal?: () => Promise<string | null>;
  className?: string;
};

/**
 * A masked contact field (admin-ux §9.2; PLAN D125: only requester or reporter contact is masked, no
 * blur). "Show" asks the server, which records the reveal; the value then shows for 60 seconds and
 * masks itself again. Phones and emails become tap-to-call and tap-to-email while shown.
 */
export function Masked({ masked, kind, label, canReveal, onReveal, className }: MaskedProps) {
  const [value, setValue] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    if (value === null) return;
    const t = setTimeout(() => setValue(null), REVEAL_MS);
    return () => clearTimeout(t);
  }, [value]);

  const reveal = () => {
    if (!onReveal) return;
    startTransition(async () => {
      try {
        const v = await onReveal();
        if (v === null) {
          toast({ title: "This isn't open to your role.", tone: "danger" });
          return;
        }
        setValue(v);
        toast({ title: "Viewed: logged in activity", description: COPY["mask.revealNote"], duration: 4000 });
      } catch {
        toast({ title: COPY["error.server"], tone: "danger" });
      }
    });
  };

  const shown = value !== null;
  const href = shown ? (kind === "phone" ? `tel:${value.replace(/[^\d+]/g, "")}` : kind === "email" ? `mailto:${value}` : null) : null;

  return (
    <span className={cn("inline-flex max-w-full flex-wrap items-center gap-2", className)}>
      {shown && href ? (
        <a href={href} className="font-grotesk text-[15px] font-semibold tabular-nums text-forest underline underline-offset-4">
          {value}
        </a>
      ) : (
        <span className={cn("font-grotesk text-[15px] tabular-nums", shown ? "font-semibold text-ink" : "text-body")}>
          {shown ? value : masked || COPY["mask.hidden"]}
        </span>
      )}
      {shown ? (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => toast({ title: COPY["toast.copied"], duration: 2500 }));
          }}
          aria-label={`Copy ${label.toLowerCase()}`}
          className="grid size-9 place-items-center rounded-full text-forest transition-colors hover:bg-mint"
        >
          <Copy aria-hidden className="size-4" strokeWidth={2.25} />
        </button>
      ) : canReveal && onReveal ? (
        <button
          type="button"
          onClick={reveal}
          disabled={pending}
          aria-label={`${COPY["mask.show"]} ${label.toLowerCase()}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-ink/70 px-3.5 text-[13px] font-bold text-ink transition-colors hover:border-forest hover:bg-forest hover:text-white disabled:opacity-60"
        >
          {pending ? <Spinner size={16} label="Checking" /> : <Eye aria-hidden className="size-3.5" strokeWidth={2.5} />}
          {COPY["mask.show"]}
        </button>
      ) : null}
    </span>
  );
}
