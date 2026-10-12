"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Check, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { SectionDTO } from "@/lib/studio/server";
import { SchemaForm } from "./SchemaForm";
import { useAutosave, type SaveState } from "./useAutosave";

type SaveDoc = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ version: number; at: Millis }>>;

export function SaveStatus({ state }: { state: SaveState }) {
  if (state.kind === "saving")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] text-body">
        <Loader2 aria-hidden className="size-4 animate-spin" /> Saving…
      </span>
    );
  if (state.kind === "saved")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-deep">
        <Check aria-hidden className="size-4" /> Saved as a draft · not live yet
      </span>
    );
  if (state.kind === "invalid")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-coral-800">
        <CircleAlert aria-hidden className="size-4" /> Not saved yet: {Object.values(state.fields)[0] ?? "check the highlighted fields."}
      </span>
    );
  if (state.kind === "error" || state.kind === "conflict")
    return (
      <span className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-coral-800">
        <CircleAlert aria-hidden className="size-4" /> {state.message}
      </span>
    );
  return <span className="text-[13.5px] text-body">Changes save as a draft while you type.</span>;
}

/**
 * The sheet for one section of a page (admin-ux §6.10): its fields from SchemaForm, autosaved as a
 * draft, the preview refreshed after each save. A stale version (someone else saved) shows the
 * conflict panel instead of overwriting their work.
 */
export function SectionSheet({
  id,
  open,
  onClose,
  load,
  save,
  onSaved,
  onOpenCollection,
}: {
  id: string | null;
  open: boolean;
  onClose: () => void;
  load: (id: string) => Promise<SectionDTO | null>;
  save: SaveDoc;
  onSaved: () => void;
  onOpenCollection: (name: string) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Edit this section" size="lg">
      {open && id ? <SectionLoader key={id} id={id} load={load} save={save} onSaved={onSaved} onOpenCollection={onOpenCollection} /> : null}
    </Sheet>
  );
}

function SectionLoader({ id, load, save, onSaved, onOpenCollection }: { id: string; load: (id: string) => Promise<SectionDTO | null>; save: SaveDoc; onSaved: () => void; onOpenCollection: (name: string) => void }) {
  const [d, setD] = useState<SectionDTO | null>(null);
  const [failed, setFailed] = useState(false);
  // Load once per section: a refresh after each save hands us a new `load` reference, and reloading
  // then would remount the form and lose the open items and the caret.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });
  useEffect(() => {
    let alive = true;
    loadRef.current(id)
      .then((x) => alive && (x ? setD(x) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [id]);
  if (failed) return <p className="text-[15px] text-body">This section couldn’t be opened. Close the sheet and try again.</p>;
  if (!d) return <p className="text-[15px] text-body">Loading…</p>;
  return (
    <div className="grid gap-3">
      <div>
        <h3 className="text-[19px] font-extrabold text-ink">{d.label}</h3>
        <p className="text-[14px] text-body">{d.hasDraft ? "This section has changes that aren’t live yet." : "Changes stay a draft until you put them live."}</p>
      </div>
      <SectionBody key={`${d.id}:${d.version}`} d={d} save={save} onSaved={onSaved} onOpenCollection={onOpenCollection} reload={() => load(id).then((x) => x && setD(x))} />
    </div>
  );
}

function SectionBody({ d, save, onSaved, onOpenCollection, reload }: { d: SectionDTO; save: SaveDoc; onSaved: () => void; onOpenCollection: (name: string) => void; reload: () => void }) {
  const [value, setValue] = useState<unknown>(d.value);
  const auto = useAutosave<unknown>(d.version, async (v, base) => save({ id: d.id, baseVersion: base, data: v, intent: "draft" }), onSaved);
  const errors = auto.state.kind === "invalid" ? auto.state.fields : {};

  if (d.managedIn) {
    return (
      <div className="grid gap-3">
        <p className="text-[15px] text-ink">This is kept somewhere else, so everything stays in one place.</p>
        <Button href={d.managedIn} variant="forest" icon="none" className="w-fit">
          Open it <ArrowUpRight aria-hidden className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="sticky -top-1 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-white/95 px-1 py-2 backdrop-blur">
        <SaveStatus state={auto.state} />
        {d.related ? (
          <button type="button" onClick={() => onOpenCollection(d.related!.name)} className="inline-flex items-center gap-1 text-[14px] font-bold text-forest underline-offset-4 hover:underline">
            Edit the {d.related.label.toLowerCase()} themselves <ArrowUpRight aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
      {auto.state.kind === "conflict" ? (
        <div role="alert" className="grid gap-2 rounded-[16px] bg-marigold-100 p-4 text-[14.5px] text-umber">
          <p className="font-bold">Someone else changed this section while you were editing.</p>
          <p>Copy anything you want to keep, then load their version and add your change again.</p>
          <Button type="button" variant="outline" size="sm" icon="none" className="w-fit" onClick={reload}>
            Load the latest version
          </Button>
        </div>
      ) : null}
      {!d.canEdit ? <p className="rounded-[14px] bg-pebble/60 p-3 text-[14px] text-body">You can look, but this section is changed by someone else on the team.</p> : null}
      <SchemaForm
        schema={d.schema}
        value={value}
        locked={d.locked}
        media={d.media}
        errors={errors}
        videoPaths={d.videoPaths}
        disabled={!d.canEdit || auto.state.kind === "conflict"}
        onChange={(v) => {
          setValue(v);
          auto.change(v);
        }}
      />
      {Object.keys(d.locked).length && d.canEdit ? (
        <Link href="/admin/help" className="text-[13px] text-body underline-offset-4 hover:underline">
          Why are some fields locked?
        </Link>
      ) : null}
    </div>
  );
}
