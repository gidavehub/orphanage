"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { NoteTargetDTO } from "@/lib/server/dal/appointments";
import { addSessionNoteAction, noteTargetsAction } from "@/app/admin/(desk)/counselling/actions";

/**
 * Global sheet `?do=add-note` (admin-ux §3.4): a follow-up note on one of your sessions from the last
 * two weeks (or the session in `?ref=`). Notes are sealed and only counselling staff can read them.
 */
export function AddNoteSheet({ open, onClose, params }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [targets, setTargets] = useState<NoteTargetDTO[] | null>(null);
  const [ref, setRef] = useState(params.ref ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let live = true;
    noteTargetsAction()
      .then((t) => {
        if (!live) return;
        setTargets(t);
        setRef((r) => r || t[0]?.ref || "");
      })
      .catch(() => live && setTargets([]));
    return () => {
      live = false;
    };
  }, []);

  const submit = () =>
    start(async () => {
      const r = await addSessionNoteAction(ref, text);
      if (r.ok) {
        toast({ title: "Note added", tone: "success" });
        onClose();
        router.refresh();
        return;
      }
      const e = r.error;
      setError(e.kind === "validation" ? Object.values(e.fields)[0] : e.message);
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  const options = targets ?? [];
  const known = options.some((t) => t.ref === ref);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a follow-up note"
      description="A short note on one of your sessions. Only the counselling team can read it."
      dirty={Boolean(text)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || !ref || text.trim().length === 0} onClick={submit}>
          Add the note
        </Button>
      }
    >
      <div className="grid gap-4">
        {targets === null ? (
          <p className="text-[15px] text-body">Finding your sessions…</p>
        ) : options.length === 0 && !params.ref ? (
          <p className="rounded-2xl bg-cream px-4 py-3 text-[15px] text-body">You have no sessions in the last two weeks. Open a session to add a note to it.</p>
        ) : (
          <Field name="note-session" label="Which session?">
            <Select value={ref} options={[...(known || !ref ? [] : [{ value: ref, label: ref }]), ...options.map((t) => ({ value: t.ref, label: t.label }))]} onChange={(e) => setRef(e.target.value)} />
          </Field>
        )}
        <Field name="note-text" label="Your note" hint="What happened and what’s next. No children’s full names." counter={{ max: 4000 }} error={error}>
          <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}
