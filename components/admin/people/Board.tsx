"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useImperativeHandle, useMemo, useRef, useState, useTransition } from "react";
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ArrowRight, ChevronDown, MoveRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { FlagDisc } from "@/components/ui/flag";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import { canTakeEdge, edgesFrom, type EdgeSpec } from "@/lib/model/flows";
import type { Millis } from "@/lib/model/enums";
import { STATUS_LABEL } from "@/lib/model/labels";
import type { Permission } from "@/lib/model/permissions";
import type { PeopleCardDTO } from "@/lib/server/dal/volunteers";
import { cn } from "@/lib/cn";

type Workflow = "volunteer" | "partnership";
type Move = (ref: string, edgeId: string, version: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
type Card = PeopleCardDTO & { interests?: string[] };

const TINT = ["bg-marigold", "bg-clay", "bg-coral-800", "bg-forest", "bg-cocoa", "bg-deep"];
const label = (w: Workflow, s: string) => (s === "declined" ? "Not this time" : ((STATUS_LABEL[w] as Record<string, string>)[s] ?? s));

/**
 * People boards (admin-ux §6.9): a gentle kanban of stages on desktop (drag with @dnd-kit, or focus a
 * card and press m for "Move to…"), stage chips with a one-tap "Move to next" on phones. Every move is
 * an edge from FLOWS; a move the flow doesn't allow is refused with a sentence. Moves that need a
 * reason (or an interview time) ask first.
 */
export function Board({ workflow, lanes, resting, cards: initial, perms, canManage, filters, move }: { workflow: Workflow; lanes: string[]; resting: string[]; cards: Card[]; perms: Permission[]; canManage: boolean; filters: Array<{ value: string; label: string }>; move: Move }) {
  const router = useRouter();
  const { toast } = useToast();
  const [cards, setCards] = useState(initial);
  const [filter, setFilter] = useState<string | null>(null);
  const [phoneStage, setPhoneStage] = useState(lanes[0]!);
  const [trayOpen, setTrayOpen] = useState(false);
  const [ask, setAsk] = useState<{ card: Card; edge: EdgeSpec<string> } | null>(null);
  const [, start] = useTransition();
  const permSet = useMemo(() => new Set(perms), [perms]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const visible = filter ? cards.filter((c) => (c.interests ?? []).includes(filter)) : cards;
  const edgesFor = (c: Card) => (edgesFrom(workflow, c.status as never) as Array<EdgeSpec<string>>).filter((e) => canTakeEdge(e as never, permSet) && e.to !== c.status);

  const run = (card: Card, edge: EdgeSpec<string>, input: Record<string, unknown> = {}) =>
    start(async () => {
      const before = card.status;
      setCards((cs) => cs.map((c) => (c.ref === card.ref ? { ...c, status: edge.to, daysInStage: 0 } : c)));
      const r = await move(card.ref, edge.id, card.version, input);
      if (r.ok) {
        setCards((cs) => cs.map((c) => (c.ref === card.ref ? { ...c, version: r.data.version } : c)));
        toast({ title: `${card.title} → ${label(workflow, edge.to)}`, tone: "success" });
        router.refresh();
        return;
      }
      setCards((cs) => cs.map((c) => (c.ref === card.ref ? { ...c, status: before } : c)));
      const e = r.error;
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  const moveTo = (card: Card, to: string) => {
    if (to === card.status) return;
    const edge = edgesFor(card).find((e) => e.to === to);
    if (!edge) {
      const next = edgesFor(card).map((e) => label(workflow, e.to));
      toast({
        title: `${card.title} can’t go straight from ${label(workflow, card.status)} to ${label(workflow, to)}.`,
        description: next.length ? `Next steps from here: ${next.join(", ")}.` : "There’s no next step from here.",
        tone: "danger",
      });
      return;
    }
    if (edge.asks === "reason" || edge.asks === "schedule") setAsk({ card, edge });
    else run(card, edge);
  };

  const onDragEnd = (e: DragEndEvent) => {
    const card = cards.find((c) => c.ref === e.active.id);
    const to = e.over?.id;
    if (card && typeof to === "string") moveTo(card, to);
  };

  const count = (s: string) => visible.filter((c) => c.status === s).length;

  return (
    <div className="grid gap-4">
      {filters.length ? (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:overflow-visible md:px-0" role="group" aria-label="Filter">
          <button type="button" onClick={() => setFilter(null)} aria-pressed={filter === null} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold", filter === null ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
            Everyone
          </button>
          {filters.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value === filter ? null : f.value)} aria-pressed={filter === f.value} className={cn("h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-bold", filter === f.value ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
              {f.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* Desktop: lanes */}
      <DndContext id={`board-${workflow}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
          {lanes.map((s, i) => (
            <Lane key={s} id={s} title={label(workflow, s)} count={count(s)} tint={TINT[i % TINT.length]!}>
              {visible
                .filter((c) => c.status === s)
                .map((c) => (
                  <DraggableCard key={c.ref} card={c} disabled={!canManage} edges={canManage ? edgesFor(c) : []} workflow={workflow} onMove={(to) => moveTo(c, to)} />
                ))}
            </Lane>
          ))}
        </div>
        <div className="hidden md:block">
          <button type="button" onClick={() => setTrayOpen((x) => !x)} aria-expanded={trayOpen} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[14px] font-bold text-body shadow-soft hover:text-ink">
            Resting: {resting.map((s) => `${label(workflow, s)} ${count(s)}`).join(" · ")} <ChevronDown aria-hidden className={cn("size-4 transition-transform", trayOpen && "rotate-180")} />
          </button>
          {trayOpen ? (
            <div className="mt-3 flex gap-3 overflow-x-auto pb-2">
              {resting.map((s) => (
                <Lane key={s} id={s} title={label(workflow, s)} count={count(s)} tint="bg-pebble">
                  {visible
                    .filter((c) => c.status === s)
                    .map((c) => (
                      <DraggableCard key={c.ref} card={c} disabled={!canManage} edges={canManage ? edgesFor(c) : []} workflow={workflow} onMove={(to) => moveTo(c, to)} />
                    ))}
                </Lane>
              ))}
            </div>
          ) : null}
        </div>
      </DndContext>

      {/* Phones: stage chips and a list */}
      <div className="grid gap-3 md:hidden">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Stage">
          {[...lanes, ...resting].map((s) => (
            <button key={s} type="button" role="tab" aria-selected={phoneStage === s} onClick={() => setPhoneStage(s)} className={cn("h-10 shrink-0 rounded-full px-4 text-[14px] font-bold", phoneStage === s ? "bg-forest text-white" : "bg-white text-ink shadow-chip")}>
              {label(workflow, s)} {count(s)}
            </button>
          ))}
        </div>
        {visible.filter((c) => c.status === phoneStage).length === 0 ? <p className="rounded-[22px] bg-white p-5 text-[15px] text-body shadow-soft">No one here.</p> : null}
        {visible
          .filter((c) => c.status === phoneStage)
          .map((c) => {
            const edges = canManage ? edgesFor(c) : [];
            const next = edges.find((e) => lanes.indexOf(e.to) === lanes.indexOf(c.status) + 1) ?? edges.find((e) => !resting.includes(e.to));
            return (
              <div key={c.ref} className="rounded-[22px] bg-white p-4 shadow-soft">
                <CardBody card={c} workflow={workflow} />
                {edges.length ? (
                  <div className="mt-3 flex gap-2">
                    {next ? (
                      <button type="button" onClick={() => moveTo(c, next.to)} className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full bg-forest px-4 text-[14px] font-bold text-white">
                        Move to {label(workflow, next.to)} <ArrowRight aria-hidden className="size-4" />
                      </button>
                    ) : null}
                    <MoveMenu edges={edges} workflow={workflow} onMove={(to) => moveTo(c, to)} compact />
                  </div>
                ) : null}
              </div>
            );
          })}
      </div>

      <AskSheet ask={ask} workflow={workflow} onClose={() => setAsk(null)} onConfirm={(input) => ask && (run(ask.card, ask.edge, input), setAsk(null))} />
    </div>
  );
}

function Lane({ id, title, count, tint, children }: { id: string; title: string; count: number; tint: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section ref={setNodeRef} aria-label={`${title} (${count})`} className={cn("flex w-[248px] shrink-0 flex-col rounded-[22px] bg-cream-2 p-3 transition-shadow", isOver && "ring-2 ring-forest/50 shadow-[0_0_0_6px_rgba(208,240,223,0.9)]")}>
      <header className="mb-3 px-1">
        <p className="text-[15px] font-extrabold text-ink">
          {title} <span className="font-grotesk text-[13px] font-semibold text-body">{count}</span>
        </p>
        <span aria-hidden className={cn("mt-1.5 block h-1 w-12 rounded-full opacity-80", tint)} />
      </header>
      <div className="grid min-h-[60px] content-start gap-2.5">{children}</div>
    </section>
  );
}

function CardBody({ card, workflow }: { card: Card; workflow: Workflow }) {
  const waiting = card.daysInStage >= 14 && !["active", "inactive", "declined", "closed"].includes(card.status);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/people/${card.ref}`} className="min-w-0 text-[15px] font-bold leading-snug text-ink hover:text-forest hover:underline">
          {card.title}
        </Link>
        <FlagDisc code={card.country} className="size-5 shrink-0" label={card.country.toUpperCase()} />
      </div>
      {card.subtitle ? <p className="mt-0.5 text-[12.5px] text-body">{card.subtitle}</p> : null}
      {card.chips.length ? (
        <p className="mt-2 flex flex-wrap gap-1">
          {card.chips.map((c) => (
            <span key={c} className="rounded-full bg-sand px-2 py-0.5 text-[12px] font-semibold text-umber">
              {c}
            </span>
          ))}
          {card.moreChips ? <span className="rounded-full bg-pebble px-2 py-0.5 text-[12px] font-semibold text-body">+{card.moreChips}</span> : null}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2 text-[12.5px]">
        <span className={cn(waiting ? "rounded-full bg-marigold-100 px-2 py-0.5 font-bold text-umber" : "text-body")}>{waiting ? `Waiting ${card.daysInStage} days` : card.daysInStage === 0 ? "Today" : `${card.daysInStage} day${card.daysInStage === 1 ? "" : "s"}`}</span>
        {card.ready ? <span className="font-semibold text-deep">{card.ready.done} of {card.ready.total} ready</span> : null}
        {card.followUp ? <Avatar name={card.followUp.name} uid={card.followUp.uid} size={28} /> : null}
      </div>
      <span className="sr-only">Stage: {label(workflow, card.status)}</span>
    </>
  );
}

function DraggableCard({ card, disabled, edges, workflow, onMove }: { card: Card; disabled: boolean; edges: Array<EdgeSpec<string>>; workflow: Workflow; onMove: (to: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.ref, disabled });
  const menu = useRef<MoveMenuHandle>(null);
  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      {...listeners}
      {...attributes}
      role="group"
      data-ref={card.ref}
      aria-roledescription="card"
      aria-label={`${card.title}, ${label(workflow, card.status)}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "m" || e.key === "M") && edges.length) {
          e.preventDefault();
          menu.current?.open();
        }
      }}
      className={cn("relative rounded-[16px] bg-white p-3 shadow-card outline-none focus-visible:ring-2 focus-visible:ring-forest", !disabled && "cursor-grab", isDragging && "z-10 rotate-2 cursor-grabbing shadow-card-hover")}
    >
      <CardBody card={card} workflow={workflow} />
      {edges.length ? (
        <div className="mt-2 border-t border-line pt-2" onPointerDown={(e) => e.stopPropagation()}>
          <MoveMenu ref={menu} edges={edges} workflow={workflow} onMove={onMove} />
        </div>
      ) : null}
    </article>
  );
}

type MoveMenuHandle = { open: () => void };

function MoveMenu({ edges, workflow, onMove, compact, ref }: { edges: Array<EdgeSpec<string>>; workflow: Workflow; onMove: (to: string) => void; compact?: boolean; ref?: React.Ref<MoveMenuHandle> }) {
  const [open, setOpen] = useState(false);
  const first = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => ({
    open() {
      setOpen(true);
      setTimeout(() => first.current?.focus(), 0);
    },
  }));
  return (
    <div className="relative" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          setOpen((x) => !x);
          setTimeout(() => first.current?.focus(), 0);
        }}
        className={cn("inline-flex items-center gap-1 font-bold text-forest", compact ? "h-11 rounded-full border border-line px-4 text-[14px]" : "text-[12.5px] hover:underline")}
      >
        <MoveRight aria-hidden className="size-3.5" /> Move to…
      </button>
      {open ? (
        <div role="menu" className="absolute left-0 top-full z-20 mt-1 grid min-w-[190px] gap-0.5 rounded-[14px] bg-white p-1.5 shadow-card-hover ring-1 ring-line">
          {edges.map((e, i) => (
            <button
              key={e.id}
              ref={i === 0 ? first : undefined}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onMove(e.to);
              }}
              onKeyDown={(ev) => {
                const items = [...(ev.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>("[role=menuitem]") ?? [])];
                const at = items.indexOf(ev.currentTarget);
                const to = ev.key === "ArrowDown" ? at + 1 : ev.key === "ArrowUp" ? at - 1 + items.length : null;
                if (to !== null) {
                  ev.preventDefault();
                  items[to % items.length]?.focus();
                }
              }}
              className="rounded-[10px] px-3 py-2 text-left text-[14px] font-semibold text-ink hover:bg-sand focus:bg-sand focus:outline-none"
            >
              {label(workflow, e.to)} <span className="font-normal text-body">· {e.verb}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AskSheet({ ask, workflow, onClose, onConfirm }: { ask: { card: Card; edge: EdgeSpec<string> } | null; workflow: Workflow; onClose: () => void; onConfirm: (input: Record<string, unknown>) => void }) {
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState("");
  const schedule = ask?.edge.asks === "schedule";
  return (
    <Sheet
      open={ask !== null}
      onClose={() => {
        setReason("");
        setWhen("");
        onClose();
      }}
      title={ask ? `${ask.edge.verb}: ${ask.card.title}` : ""}
      description={ask ? `Moves to ${label(workflow, ask.edge.to)}.` : undefined}
      size="sm"
      footer={
        <Button
          type="button"
          variant="forest"
          icon="none"
          block
          disabled={!schedule && reason.trim().length < 3}
          onClick={() => {
            onConfirm(schedule ? (when ? { interviewAt: Date.parse(when) } : {}) : { reason });
            setReason("");
            setWhen("");
          }}
        >
          {ask?.edge.verb ?? "Move"}
        </Button>
      }
    >
      {schedule ? (
        <Field name="interviewAt" label="When is the interview?" hint="You can leave this empty and set it later." optional>
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </Field>
      ) : (
        <Field name="reason" label="Why?" hint="A short line for the team. It isn’t sent to them.">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      )}
    </Sheet>
  );
}
