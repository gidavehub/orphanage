"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StatusStepper } from "@/components/admin/ui/StatusStepper";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Select } from "@/components/ui/form/Select";
import { Textarea } from "@/components/ui/form/Textarea";
import type { ActionResult } from "@/lib/forms/types";
import type { EdgeSpec } from "@/lib/model/flows";
import type { Millis } from "@/lib/model/enums";
import { SUPPORT_CATEGORY_LABEL } from "@/lib/model/labels";
import type { Permission } from "@/lib/model/permissions";
import type { StatusOf } from "@/lib/model/status";

type Move = (ref: string, edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;

function useHandle() {
  const { toast } = useToast();
  const router = useRouter();
  return (r: ActionResult<unknown>, ok: string): boolean => {
    if (r.ok) {
      toast({ title: ok, tone: "success" });
      return true;
    }
    const e = r.error;
    if (e.kind === "conflict") {
      toast({ title: "Someone else saved changes a moment ago", description: "The page has been refreshed.", tone: "danger" });
      router.refresh();
    } else toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    return false;
  };
}

/** Message stages: Reply (by email), Mark as done, Mark as spam; plus Turn into a support request. */
export function MessageControls({
  reference,
  status,
  version,
  perms,
  timezone,
  history,
  firstName,
  canTurnIntoRequest,
  actions,
}: {
  reference: string;
  status: StatusOf<"contact">;
  version: number;
  perms: Permission[];
  timezone: string;
  history: Array<{ status: StatusOf<"contact">; at: Millis }>;
  firstName: string;
  canTurnIntoRequest: boolean;
  actions: { move: Move; toRequest: (ref: string, category: never) => Promise<ActionResult<{ ref: string }>> };
}) {
  const [edge, setEdge] = useState<EdgeSpec<StatusOf<"contact">> | null>(null);
  const [turning, setTurning] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("");
  const [pending, start] = useTransition();
  const handle = useHandle();
  const router = useRouter();

  const run = (id: string, input: Record<string, unknown>, ok: string) =>
    start(async () => {
      if (handle(await actions.move(reference, id, version, input), ok)) {
        setEdge(null);
        setText("");
      }
    });

  return (
    <div className="grid gap-4">
      <StatusStepper workflow="contact" status={status} perms={perms} history={history} timezone={timezone} pending={pending} onMove={(e) => (e.asks ? setEdge(e) : run(e.id, {}, e.verb))} />
      {canTurnIntoRequest && status !== "closed" && status !== "spam" ? (
        <div>
          <Button variant="outline" size="sm" icon="none" onClick={() => setTurning(true)}>
            Turn into a support request
          </Button>
        </div>
      ) : null}
      {edge ? (
        <Sheet
          open
          onClose={() => setEdge(null)}
          title={`Reply to ${firstName}`}
          dirty={!!text}
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="quiet" icon="none" onClick={() => setEdge(null)}>
                Cancel
              </Button>
              <Button variant="forest" icon="send" loading={pending} disabled={text.trim().length < 5} onClick={() => run("reply", { message: text }, "Reply queued in the outbox")}>
                Send reply
              </Button>
            </div>
          }
        >
          <Field name="reply" label="Your reply" hint="It's sent as “A reply from Haven”, signed by the team. Please don't include anything about a child.">
            <Textarea rows={8} value={text} onChange={(e) => setText(e.currentTarget.value)} maxLength={3000} />
          </Field>
        </Sheet>
      ) : null}
      {turning ? (
        <Sheet
          open
          onClose={() => setTurning(false)}
          title="Turn into a support request"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="quiet" icon="none" onClick={() => setTurning(false)}>
                Cancel
              </Button>
              <Button
                variant="forest"
                icon="none"
                loading={pending}
                disabled={!category}
                onClick={() =>
                  start(async () => {
                    const r = await actions.toRequest(reference, category as never);
                    if (handle(r, r.ok ? `Created ${r.data.ref}` : "")) {
                      setTurning(false);
                      if (r.ok) router.push(`/admin/requests/${encodeURIComponent(r.data.ref)}`);
                    }
                  })
                }
              >
                Create the request
              </Button>
            </div>
          }
        >
          <p className="mb-5 text-[15px] leading-relaxed text-body">The message becomes a new support request that you look after, and this message is closed with a link to it.</p>
          <Field name="category" label="What kind of support?">
            <Select
              value={category}
              onChange={(e) => setCategory(e.currentTarget.value)}
              placeholder="Choose one"
              options={(Object.keys(SUPPORT_CATEGORY_LABEL) as Array<keyof typeof SUPPORT_CATEGORY_LABEL>).map((c) => ({ value: c, label: SUPPORT_CATEGORY_LABEL[c] }))}
            />
          </Field>
        </Sheet>
      ) : null}
    </div>
  );
}

/** Story stages, Decline with a reason, and Turn into a testimonial draft. */
export function StoryControls({
  reference,
  status,
  version,
  perms,
  timezone,
  history,
  story,
  canMakeDraft,
  actions,
}: {
  reference: string;
  status: StatusOf<"storySubmission">;
  version: number;
  perms: Permission[];
  timezone: string;
  history: Array<{ status: StatusOf<"storySubmission">; at: Millis }>;
  story: string;
  canMakeDraft: boolean;
  actions: { move: Move; toTestimonial: (ref: string, quote: string) => Promise<ActionResult<{ id: string }>> };
}) {
  const [edge, setEdge] = useState<EdgeSpec<StatusOf<"storySubmission">> | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState(story.slice(0, 280));
  const [pending, start] = useTransition();
  const handle = useHandle();

  const run = (id: string, input: Record<string, unknown>, ok: string) =>
    start(async () => {
      if (handle(await actions.move(reference, id, version, input), ok)) setEdge(null);
    });

  return (
    <div className="grid gap-4">
      <StatusStepper workflow="storySubmission" status={status} perms={perms} history={history} timezone={timezone} pending={pending} onMove={(e) => (e.asks ? setEdge(e) : run(e.id, {}, e.verb))} />
      {canMakeDraft ? (
        <div>
          <Button variant="outline" size="sm" icon="none" onClick={() => setDrafting(true)}>
            Turn into a testimonial (draft)
          </Button>
        </div>
      ) : null}
      {edge ? (
        <Sheet
          open
          onClose={() => setEdge(null)}
          title="Decline this story"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="quiet" icon="none" onClick={() => setEdge(null)}>
                Cancel
              </Button>
              <Button variant="forest" icon="none" loading={pending} disabled={!reason.trim()} onClick={() => run("decline", { reason }, "Declined")}>
                Decline
              </Button>
            </div>
          }
        >
          <Field name="reason" label="Why? (only the team sees this)">
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={500} />
          </Field>
        </Sheet>
      ) : null}
      {drafting ? (
        <Sheet
          open
          onClose={() => setDrafting(false)}
          title="Turn into a testimonial"
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="quiet" icon="none" onClick={() => setDrafting(false)}>
                Cancel
              </Button>
              <Button
                variant="forest"
                icon="none"
                loading={pending}
                disabled={quote.trim().length < 20 || quote.trim().length > 280}
                onClick={() =>
                  start(async () => {
                    if (handle(await actions.toTestimonial(reference, quote), "Draft testimonial created in Website › Testimonials")) setDrafting(false);
                  })
                }
              >
                Create the draft
              </Button>
            </div>
          }
        >
          <p className="mb-5 text-[15px] leading-relaxed text-body">The draft stays off the website until written consent is recorded on it. Shorten the quote to the heart of the story, and leave out children&rsquo;s names and exact places.</p>
          <Field name="quote" label="The quote" hint="20 to 280 characters." counter={{ max: 280 }}>
            <Textarea rows={5} value={quote} onChange={(e) => setQuote(e.currentTarget.value)} maxLength={320} />
          </Field>
        </Sheet>
      ) : null}
    </div>
  );
}
