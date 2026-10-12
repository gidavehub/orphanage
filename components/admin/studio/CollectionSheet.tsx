"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Eye, EyeOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { CollectionDTO, CollectionItemDTO } from "@/lib/studio/server";
import { cn } from "@/lib/cn";
import { defaultFor, SchemaForm } from "./SchemaForm";
import { SaveStatus } from "./SectionSheet";
import { useAutosave } from "./useAutosave";

type R<T = { version: number; at: Millis }> = Promise<ActionResult<T>>;
export type CollectionActions = {
  load: (name: string) => Promise<CollectionDTO | null>;
  save: (input: { collection: string; id?: string; baseVersion?: number; data: unknown; intent: "draft" | "publish" }) => R<{ id: string; version: number; at: Millis }>;
  visibility: (input: { collection: string; id: string; baseVersion: number; visibility: "live" | "hidden" | "archived" }) => R;
  reorder: (input: { collection: string; orderedIds: string[] }) => R;
};

/**
 * A collection's items for the studio (admin-ux §6.10 list editors): compact cards with Showing /
 * Hidden and ↑/↓, ＋ Add, and each item's fields in the same SchemaForm, autosaved as a draft.
 */
export function CollectionSheet({ name, open, onClose, actions, onSaved }: { name: string | null; open: boolean; onClose: () => void; actions: CollectionActions; onSaved: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit the list" size="lg">
      {open && name ? <CollectionBody key={name} name={name} actions={actions} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function CollectionBody({ name, actions, onSaved }: { name: string; actions: CollectionActions; onSaved: () => void }) {
  const { toast } = useToast();
  const [d, setD] = useState<CollectionDTO | null>(null);
  const [editing, setEditing] = useState<CollectionItemDTO | "new" | null>(null);
  const [pending, start] = useTransition();
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });
  const reload = () => actionsRef.current.load(name).then((x) => x && setD(x));
  // Load once per collection (a refresh hands us new action references; see SectionSheet).
  useEffect(() => {
    let alive = true;
    actionsRef.current.load(name).then((x) => alive && setD(x));
    return () => {
      alive = false;
    };
  }, [name]);

  const fail = (r: ActionResult<unknown>) => {
    if (r.ok) return false;
    toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Please check.") : r.error.message, tone: "danger" });
    return true;
  };

  const move = (i: number, by: number) =>
    start(async () => {
      if (!d) return;
      const ids = d.items.map((x) => x.id);
      const [x] = ids.splice(i, 1);
      ids.splice(i + by, 0, x!);
      if (fail(await actions.reorder({ collection: d.name, orderedIds: ids }))) return;
      onSaved();
      await reload();
    });

  const toggle = (it: CollectionItemDTO) =>
    start(async () => {
      if (!d) return;
      if (fail(await actions.visibility({ collection: d.name, id: it.id, baseVersion: it.version, visibility: it.visibility === "live" ? "hidden" : "live" }))) return;
      toast({ title: it.visibility === "live" ? "Hidden from the website" : "Showing on the website", tone: "success" });
      onSaved();
      await reload();
    });

  if (!d) return <p className="text-[15px] text-body">Loading…</p>;
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-[19px] font-extrabold text-ink">{d.label}</h3>
        <p className="text-[14px] text-body">Each {d.itemLabel} on the website. Changes stay a draft until you put them live.</p>
      </div>
      {editing ? (
        <ItemEditor
          key={editing === "new" ? "new" : `${editing.id}:${editing.version}`}
          d={d}
          item={editing === "new" ? null : editing}
          save={actions.save}
          onBack={async () => {
            setEditing(null);
            await reload();
          }}
          onSaved={onSaved}
        />
      ) : (
        <div className="grid gap-3">
          <ul className="grid gap-2">
            {d.items.map((it, i) => (
              <li key={it.id} className={cn("flex items-center gap-2 rounded-[16px] border border-line bg-white p-2 pl-3", it.visibility !== "live" && "opacity-70")}>
                <button type="button" onClick={() => setEditing(it)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[15px] font-bold text-ink hover:text-forest">{it.label}</span>
                  <span className="text-[12.5px] text-body">
                    {it.visibility === "live" ? "Showing" : "Hidden"}
                    {it.hasDraft ? " · changes not live yet" : ""}
                    {!it.everLive ? " · new" : ""}
                    {it.placeholder ? " · example" : ""}
                  </span>
                </button>
                {d.canPublish && it.everLive ? (
                  <button type="button" aria-label={it.visibility === "live" ? `Hide ${it.label}` : `Show ${it.label}`} disabled={pending} onClick={() => toggle(it)} className="grid size-9 place-items-center rounded-full text-body hover:bg-sand">
                    {it.visibility === "live" ? <Eye aria-hidden className="size-4" /> : <EyeOff aria-hidden className="size-4" />}
                  </button>
                ) : null}
                {d.canPublish ? (
                  <>
                    <button type="button" aria-label={`Move ${it.label} up`} disabled={pending || i === 0} onClick={() => move(i, -1)} className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30">
                      <ArrowUp aria-hidden className="size-4" />
                    </button>
                    <button type="button" aria-label={`Move ${it.label} down`} disabled={pending || i === d.items.length - 1} onClick={() => move(i, 1)} className="grid size-9 place-items-center rounded-full text-body hover:bg-sand disabled:opacity-30">
                      <ArrowDown aria-hidden className="size-4" />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
          {d.canCreate && !d.fixedIds ? (
            <button type="button" onClick={() => setEditing("new")} className="inline-flex h-10 w-fit items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
              <Plus aria-hidden className="size-4" /> Add a {d.itemLabel}
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ItemEditor({ d, item, save, onBack, onSaved }: { d: CollectionDTO; item: CollectionItemDTO | null; save: CollectionActions["save"]; onBack: () => void; onSaved: () => void }) {
  const [value, setValue] = useState<unknown>(() => item?.value ?? defaultFor(d.schema as Record<string, unknown>, d.media, d.itemLabel));
  const [id, setId] = useState<string | null>(item?.id ?? null);
  const auto = useAutosave<unknown>(item?.version ?? 0, async (v, base) => {
    const r = await save({ collection: d.name, ...(id ? { id, baseVersion: base } : {}), data: v, intent: "draft" });
    if (r.ok && !id) setId(r.data.id);
    return r.ok ? { ok: true, data: { version: r.data.version } } : r;
  }, onSaved);
  return (
    <div className="grid gap-4">
      <div className="sticky -top-1 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-white/95 px-1 py-2 backdrop-blur">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          icon="none"
          onClick={async () => {
            await auto.flush();
            onBack();
          }}
        >
          <ArrowLeft aria-hidden className="size-4" /> All {d.label.toLowerCase()}
        </Button>
        <SaveStatus state={auto.state} />
      </div>
      <SchemaForm
        schema={d.schema}
        value={value}
        locked={item?.locked ?? {}}
        media={d.media}
        errors={auto.state.kind === "invalid" ? auto.state.fields : {}}
        disabled={!d.canEdit || auto.state.kind === "conflict"}
        onChange={(v) => {
          setValue(v);
          auto.change(v);
        }}
      />
    </div>
  );
}
