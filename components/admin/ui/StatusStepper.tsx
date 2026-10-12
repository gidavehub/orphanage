"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { Check, Flag } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusPill } from "@/components/ui/StatusPill";
import { COPY } from "@/lib/admin/copy";
import { formatStaffDate } from "@/lib/admin/format";
import { allowedEdges, toStepperFlow, type EdgeSpec } from "@/lib/model/flows";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import type { StatusOf, Workflow } from "@/lib/model/status";
import { cn } from "@/lib/cn";

export type StatusStepperProps<W extends Workflow> = {
  workflow: W;
  status: StatusOf<W>;
  /** The viewer's permissions (ShellViewer.perms): only edges they may take are offered (D75). */
  perms: readonly Permission[];
  /** Appointments: the viewer is the session's counsellor. */
  isAssignedCounsellor?: boolean;
  /** When each stage was reached, for the dates under the dots. */
  history?: ReadonlyArray<{ status: StatusOf<W>; at: Millis; by?: string }>;
  /** The person picked a next step. The page asks for anything the edge needs, then calls its Server Action. */
  onMove?: (edge: EdgeSpec<StatusOf<W>>) => void;
  /**
   * Guards (D75): edge id → the sentence explaining what must happen first ("Check and verify the
   * request first, then you can approve it."). A guarded edge shows its sentence instead of acting.
   */
  blocked?: Partial<Record<string, string>>;
  /** A move is in flight: buttons wait. */
  pending?: boolean;
  /** A sideways-scrolling strip with the current step centred (phones, split views). */
  compact?: boolean;
  /** Staff timezone for the dates. */
  timezone?: string;
  className?: string;
};

/**
 * The one stepper for every workflow (admin-ux §7, §9.2; PLAN D20, D75): the path as dots in plain
 * words, the current stage, pauses as a flag and exits as a neutral pill (never red), then "Next:"
 * buttons for exactly the edges this person may take. Guards are shown as sentences, not errors.
 */
export function StatusStepper<W extends Workflow>({
  workflow,
  status,
  perms,
  isAssignedCounsellor,
  history,
  onMove,
  blocked,
  pending,
  compact,
  timezone = "Africa/Banjul",
  className,
}: StatusStepperProps<W>) {
  type S = StatusOf<W>;
  const flow = useMemo(() => toStepperFlow(workflow), [workflow]);
  const edges = useMemo(
    () => allowedEdges(workflow, status, new Set(perms), { isAssignedCounsellor }).filter((e) => e.to !== status),
    [workflow, status, perms, isAssignedCounsellor],
  );
  const guardId = useId();
  const strip = useRef<HTMLOListElement>(null);

  const path = flow.path as S[];
  const onPath = path.indexOf(status);
  const isPause = (flow.pauses as S[]).includes(status);
  const isExit = (flow.exits as S[]).includes(status);
  // Off the path: the furthest path stage the record reached before (from history), else none.
  const reached = onPath >= 0 ? onPath : Math.max(-1, ...(history ?? []).map((h) => path.indexOf(h.status)));
  const whenReached = new Map<S, Millis>();
  for (const h of history ?? []) if (!whenReached.has(h.status) || (whenReached.get(h.status) ?? 0) < h.at) whenReached.set(h.status, h.at);

  useEffect(() => {
    if (!compact || !strip.current) return;
    const current = strip.current.querySelector<HTMLElement>("[data-current]");
    current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [compact, status]);

  const forward = edges.filter((e) => !e.reopen && path.includes(e.to) && path.indexOf(e.to) > reached);
  const other = edges.filter((e) => !forward.includes(e));

  return (
    <div className={cn("grid gap-5", className)}>
      <ol
        ref={strip}
        // A sideways-scrolling strip must be reachable by keyboard (WCAG 2.1.1).
        tabIndex={compact ? 0 : undefined}
        aria-label={`${COPY["record.stage"]}: ${flow.labels[status] ?? status}`}
        className={cn("flex items-start", compact ? "scrollbar-none scroll-fade-x -mx-1 overflow-x-auto px-1 pb-1" : "flex-wrap gap-y-4")}
      >
        {path.map((s, i) => {
          const done = i < reached || (i === reached && !isPause && onPath < 0);
          const current = i === onPath;
          const flagged = isPause && i === reached;
          const at = whenReached.get(s);
          return (
            <li
              key={s}
              data-current={current || flagged ? "" : undefined}
              aria-current={current ? "step" : undefined}
              className={cn("flex min-w-[96px] flex-1 flex-col items-start", compact && "shrink-0")}
            >
              <div className="flex w-full items-center">
                <span
                  aria-hidden
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-full border-2 transition-colors",
                    done && "border-forest bg-forest text-white",
                    current && "border-marigold bg-white ring-4 ring-marigold/25",
                    flagged && "border-marigold bg-marigold text-night",
                    !done && !current && !flagged && "border-line bg-white",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3.5} /> : flagged ? <Flag className="size-3" strokeWidth={3} /> : null}
                </span>
                {i < path.length - 1 ? <span aria-hidden className={cn("mx-1.5 h-0.5 flex-1 rounded-full", i < reached ? "bg-forest" : "bg-line")} /> : null}
              </div>
              <span className={cn("mt-2 pr-2 text-[13px] leading-snug", current ? "font-extrabold text-ink" : done ? "font-semibold text-ink" : "text-body")}>
                {flow.labels[s]}
                {done ? <span className="sr-only"> (done)</span> : null}
              </span>
              {at && (done || current) ? <span className="font-grotesk text-[12px] tabular-nums text-body">{formatStaffDate(at, timezone)}</span> : null}
            </li>
          );
        })}
      </ol>

      {isPause || isExit ? (
        <p className="flex flex-wrap items-center gap-2 text-[14px] text-body">
          Now: <StatusPill workflow={workflow} status={status} size="sm" />
        </p>
      ) : null}

      {onMove && edges.length ? (
        <div className="grid gap-3">
          <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-body">{COPY["record.nextStep"]}</p>
          <div className="flex flex-wrap gap-2.5">
            {[...forward, ...other].map((e, i) => {
              const guard = blocked?.[e.id];
              const primary = i === 0 && forward.length > 0;
              return (
                <Button
                  key={e.id}
                  type="button"
                  size="sm"
                  icon="none"
                  variant={primary ? "forest" : "quiet"}
                  disabled={pending}
                  aria-disabled={guard ? true : undefined}
                  aria-describedby={guard ? `${guardId}-${e.id}` : undefined}
                  onClick={() => {
                    if (!guard) onMove(e);
                  }}
                >
                  {e.verb}
                </Button>
              );
            })}
          </div>
          {[...forward, ...other].map((e) =>
            blocked?.[e.id] ? (
              <p key={e.id} id={`${guardId}-${e.id}`} className="rounded-2xl bg-marigold-100 px-4 py-3 text-[14px] leading-snug text-umber">
                {blocked[e.id]}
              </p>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}
