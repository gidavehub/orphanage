"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import type { RecordKey } from "@/lib/content/types";
import type { ActionError, ActionResult } from "@/lib/forms/types";
import type { DraftChangeDTO } from "@/lib/studio/server";

export type PublishActions = {
  load: () => Promise<DraftChangeDTO[]>;
  publishAll: (keys: RecordKey[]) => Promise<ActionResult<{ published: RecordKey[]; failed: Array<{ key: RecordKey; error: ActionError }> }>>;
  undo: (change: { key: RecordKey; version: number; everLive: boolean }) => Promise<ActionResult<unknown>>;
};

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Banjul" });
const keyOf = (k: RecordKey) => (k.kind === "doc" ? k.id : `${k.collection}/${k.id}`);

/**
 * "Review & put live" (admin-ux §6.10; PLAN D61): every change not live yet in plain words, each with
 * "Undo this change", then one confirm to put them all live.
 */
export function PublishSheet({ open, onClose, actions, onDone, canPublish }: { open: boolean; onClose: () => void; actions: PublishActions; onDone: () => void; canPublish: boolean }) {
  const { toast } = useToast();
  const [changes, setChanges] = useState<DraftChangeDTO[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const reload = async () => setChanges(await actions.load());

  const putLive = () =>
    start(async () => {
      if (!changes?.length) return;
      const r = await actions.publishAll(changes.map((c) => c.key));
      if (!r.ok) {
        toast({ title: "message" in r.error ? r.error.message : "Nothing went live. Please try again.", tone: "danger" });
        return;
      }
      const { published, failed } = r.data;
      if (failed.length) {
        const first = failed[0]!.error;
        toast({ title: `${published.length} live, ${failed.length} not yet`, description: first.kind === "blocked" ? first.reasons[0] : "message" in first ? first.message : undefined, tone: "danger" });
      } else toast({ title: `${published.length} change${published.length === 1 ? "" : "s"} live on the website`, tone: "success" });
      onDone();
      await reload();
      setConfirm(false);
    });

  return (
    <Sheet
      open={open}
      onClose={() => {
        setConfirm(false);
        setChanges(null);
        onClose();
      }}
      title="Changes not live yet"
      description="Check each change, then put them live together."
      size="md"
      footer={
        canPublish && changes?.length ? (
          confirm ? (
            <div className="grid gap-2">
              <p className="text-[14px] text-ink">Put {changes.length} change{changes.length === 1 ? "" : "s"} live for everyone?</p>
              <div className="flex gap-2">
                <Button type="button" variant="forest" icon="none" loading={pending} disabled={pending} onClick={putLive} className="flex-1">
                  Yes, put them live
                </Button>
                <Button type="button" variant="ghost" icon="none" onClick={() => setConfirm(false)}>
                  Not yet
                </Button>
              </div>
            </div>
          ) : (
            <Button type="button" variant="forest" icon="none" block onClick={() => setConfirm(true)}>
              Put these changes live
            </Button>
          )
        ) : undefined
      }
    >
      {open ? <Loader key="loader" load={actions.load} onLoad={setChanges} /> : null}
      {!changes ? (
        <p className="text-[15px] text-body">Loading…</p>
      ) : changes.length === 0 ? (
        <p className="text-[15px] text-body">Everything on the website is up to date.</p>
      ) : (
        <ul className="grid gap-3">
          {changes.map((c) => (
            <li key={keyOf(c.key)} className="rounded-[16px] border border-line p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-[15px] font-bold text-ink">{c.label}</p>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const r = await actions.undo({ key: c.key, version: c.version, everLive: c.everLive });
                      if (r.ok) {
                        toast({ title: "Change undone", tone: "success" });
                        onDone();
                        await reload();
                      } else toast({ title: "message" in r.error ? r.error.message : "That change couldn’t be undone.", tone: "danger" });
                    })
                  }
                  className="shrink-0 text-[13.5px] font-bold text-coral-800 underline-offset-4 hover:underline"
                >
                  Undo this change
                </button>
              </div>
              <ul className="mt-1 grid gap-0.5 text-[13.5px] text-body">
                {c.lines.map((l) => (
                  <li key={l}>· {l}</li>
                ))}
              </ul>
              <p className="mt-1 text-[12.5px] text-body">
                {c.by} · {when.format(c.at)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {!canPublish && changes?.length ? <p className="mt-4 text-[14px] text-body">Someone who can publish puts these live.</p> : null}
    </Sheet>
  );
}

/** Loads the changes when the sheet opens (mounted only while it is open). */
function Loader({ load, onLoad }: { load: () => Promise<DraftChangeDTO[]>; onLoad: (c: DraftChangeDTO[]) => void }) {
  const ref = useRef({ load, onLoad });
  useEffect(() => {
    ref.current = { load, onLoad };
  });
  useEffect(() => {
    let alive = true;
    ref.current.load().then((c) => alive && ref.current.onLoad(c));
    return () => {
      alive = false;
    };
  }, []);
  return null;
}
