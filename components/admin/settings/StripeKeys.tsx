"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Copy, Eye, EyeOff, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/form/Checkbox";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { RadioCards } from "@/components/ui/form/RadioCards";
import type { ActionResult } from "@/lib/forms/types";
import { CARD_CURRENCIES } from "@/lib/model/domain/settings";
import type { Currency, Millis } from "@/lib/model/enums";
import type { KeyLinkDTO, KeyRecipientDTO, StripeKeysInput, StripeKeysSaved, StripeKeysView } from "@/lib/server/dal/stripeKeys";

type Save = (input: StripeKeysInput) => Promise<ActionResult<StripeKeysSaved>>;

const CURRENCY_NAME: Record<(typeof CARD_CURRENCIES)[number], string> = { USD: "US dollars", GBP: "Pounds sterling", EUR: "Euros" };

/** The person confirms it's them, then comes straight back here. */
function useStepUp() {
  const router = useRouter();
  const path = usePathname();
  return () => router.push(`/admin/confirm?next=${encodeURIComponent(path)}`);
}

/** A pasted key: hidden like a password until "Show", never autofilled or spell-checked. */
function KeyInput({ name, placeholder, value, onChange, invalid }: { name: string; placeholder: string; value: string; onChange: (v: string) => void; invalid?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <Input
      id={name}
      name={name}
      density="admin"
      type={shown ? "text" : "password"}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      data-1p-ignore
      data-lpignore="true"
      placeholder={placeholder}
      value={value}
      invalid={invalid}
      onChange={(e) => onChange(e.target.value)}
      className="font-mono"
      trailing={
        <button type="button" onClick={() => setShown((s) => !s)} className="grid size-9 place-items-center rounded-full text-body hover:bg-ink/[0.06] hover:text-ink" aria-label={shown ? "Hide the key" : "Show the key"} aria-pressed={shown}>
          {shown ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      }
    />
  );
}

function CopyLine({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <span className="flex min-w-0 items-center gap-2 rounded-xl bg-cream px-3 py-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-ink">{text}</code>
      <button
        type="button"
        className="inline-flex shrink-0 items-center gap-1 text-[13px] font-bold text-forest"
        onClick={() => {
          void navigator.clipboard?.writeText(text).then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1800);
          });
        }}
      >
        {done ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
        {done ? "Copied" : "Copy"}
      </button>
    </span>
  );
}

/**
 * Paste the Stripe keys (Settings › Connections › Card payments, and the secure link page). Blank
 * boxes keep what's saved; Haven checks the keys with Stripe before keeping them.
 */
export function StripeKeysForm({ view, save, compact = false }: { view: StripeKeysView; save: Save; compact?: boolean }) {
  const router = useRouter();
  const stepUp = useStepUp();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const saved = view.source === "saved";
  const [secretKey, setSecretKey] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [webhook, setWebhook] = useState<"auto" | "paste" | "keep">(saved && view.hints.webhookSecret ? "keep" : view.webhookCanBeMade ? "auto" : "paste");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [currencies, setCurrencies] = useState<Currency[]>(view.currencies.length ? view.currencies : [...CARD_CURRENCIES]);
  const [portalConfigId, setPortalConfigId] = useState(view.portalConfigId ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<StripeKeysSaved | null>(null);

  const keep = (hint: string | null) => (saved && hint ? ` Saved: ••••${hint}. Leave blank to keep it.` : "");

  const submit = () =>
    start(async () => {
      const r = await save({ secretKey, publishableKey, webhook, webhookSecret, currencies, portalConfigId, baseUpdatedAt: view.baseUpdatedAt });
      if (r.ok) {
        setErrors({});
        setSecretKey("");
        setPublishableKey("");
        setWebhookSecret("");
        setDone(r.data);
        toast({ title: "Stripe keys saved", tone: "success" });
        router.refresh();
        return;
      }
      const e = r.error;
      if (e.kind === "forbidden" && e.paths?.includes("step-up")) {
        toast({ title: "Please confirm it's you first. Your keys weren't saved.", tone: "danger" });
        stepUp();
        return;
      }
      if (e.kind === "validation") setErrors(e.fields);
      if (e.kind === "conflict") router.refresh();
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check the highlighted boxes.") : e.message, tone: "danger" });
    });

  if (!view.canStore) {
    return (
      <Notice tone="warning" title="Keys can't be stored safely yet" compact>
        The server’s data key (HAVEN_DATA_KEY) isn’t set, so Haven can’t protect the keys. Ask the developer to add it, then come back.
      </Notice>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="grid gap-5"
      autoComplete="off"
      noValidate
    >
      {done ? (
        <Notice tone="success" title={`Saved. Card payments are in ${done.mode} mode.`} compact>
          {done.account ? `Stripe account: ${done.account}. ` : ""}
          {done.webhook === "made" ? "The webhook is set up in Stripe. " : done.webhook === "none" ? "No webhook yet: renewals, failed payments and refunds aren't seen until one is set. " : ""}
          Every super admin has been emailed about the change.
        </Notice>
      ) : null}

      <Field name="secretKey" label="Secret key" density="admin" error={errors.secretKey} hint={<>In Stripe: Developers › API keys › Secret key (Reveal, then copy). It starts with sk_live_, or sk_test_ for testing.{keep(view.hints.secretKey)}</>}>
        <KeyInput name="secretKey" placeholder={saved ? "Leave blank to keep the saved key" : "sk_live_…"} value={secretKey} onChange={setSecretKey} invalid={Boolean(errors.secretKey)} />
      </Field>

      <Field name="publishableKey" label="Publishable key" density="admin" error={errors.publishableKey} hint={<>On the same page: Publishable key. It starts with pk_live_ or pk_test_, from the same mode as the secret key.{keep(view.hints.publishableKey)}</>}>
        <KeyInput name="publishableKey" placeholder={saved && view.hints.publishableKey ? "Leave blank to keep the saved key" : "pk_live_…"} value={publishableKey} onChange={setPublishableKey} invalid={Boolean(errors.publishableKey)} />
      </Field>

      <RadioCards
        name="webhook"
        legend="Webhook (how Stripe tells Haven a gift went through)"
        columns={1}
        size="sm"
        value={webhook}
        onChange={(x) => setWebhook(x as typeof webhook)}
        error={errors.webhook}
        options={[
          {
            value: "auto",
            label: "Set it up for me",
            description: view.webhookCanBeMade ? "Recommended. Haven adds the webhook in Stripe and keeps its signing secret." : "Works only on Haven's public website address, not on this computer.",
            disabled: !view.webhookCanBeMade,
          },
          { value: "paste", label: "I'll paste the signing secret", description: "For a webhook you made yourself in Stripe › Developers › Webhooks." },
          saved && view.hints.webhookSecret
            ? { value: "keep", label: "Keep the saved one", description: `Signing secret ••••${view.hints.webhookSecret}${view.webhookMadeByHaven ? ", set up by Haven" : ""}.` }
            : { value: "keep", label: "Skip for now", description: "Card gifts still go through, but renewals, failed payments and refunds aren't seen until a webhook is set." },
        ]}
      />

      {webhook === "paste" ? (
        <div className="grid gap-3 rounded-[16px] border border-line p-4">
          <p className="text-[14px] text-body">In Stripe, add an endpoint with this address and these events, then copy its signing secret:</p>
          <CopyLine text={view.webhookUrl} />
          <ul className="flex flex-wrap gap-1.5">
            {view.events.map((e) => (
              <li key={e} className="rounded-md bg-cream px-2 py-0.5 font-mono text-[12px] text-ink">
                {e}
              </li>
            ))}
          </ul>
          <Field name="webhookSecret" label="Signing secret" density="admin" error={errors.webhookSecret} hint="It starts with whsec_.">
            <KeyInput name="webhookSecret" placeholder="whsec_…" value={webhookSecret} onChange={setWebhookSecret} invalid={Boolean(errors.webhookSecret)} />
          </Field>
        </div>
      ) : null}

      <fieldset className="grid gap-2">
        <legend className="text-[15px] font-bold text-ink">Currencies the Stripe account takes</legend>
        <p className="text-[13.5px] text-body">Settings › Giving still decides which currencies donors pay by card. Dalasi (GMD) always goes by mobile money or bank.</p>
        <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
          {CARD_CURRENCIES.map((c) => (
            <Checkbox
              key={c}
              name="currencies"
              value={c}
              label={`${c}, ${CURRENCY_NAME[c]}`}
              checked={currencies.includes(c)}
              onChange={(e) => setCurrencies((xs) => (e.target.checked ? [...xs, c] : xs.filter((x) => x !== c)))}
            />
          ))}
        </div>
        {errors.currencies ? <p className="text-[13.5px] font-semibold text-coral-800">{errors.currencies}</p> : null}
      </fieldset>

      {compact ? null : (
        <details className="rounded-[16px] border border-line p-4" open={Boolean(errors.portalConfigId)}>
          <summary className="cursor-pointer text-[14.5px] font-bold text-forest">More settings</summary>
          <div className="mt-3">
            <Field name="portalConfigId" label="Customer portal configuration" optional density="admin" error={errors.portalConfigId} hint="Only if Stripe gave you one for donors managing their regular gifts. It starts with bpc_.">
              <Input id="portalConfigId" name="portalConfigId" density="admin" value={portalConfigId} onChange={(e) => setPortalConfigId(e.target.value)} className="font-mono" spellCheck={false} autoComplete="off" />
            </Field>
          </div>
        </details>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" icon="none" loading={pending} disabled={pending}>
          {pending ? "Checking with Stripe…" : "Check and save the keys"}
        </Button>
        <p className="text-[13px] text-body">Haven checks the keys with Stripe first. They’re stored encrypted and never shown again.</p>
      </div>
    </form>
  );
}

/** "Remove the saved keys": card payments fall back to the server settings, or stop. */
export function RemoveStripeKeys({ remove, fallback }: { remove: () => Promise<ActionResult<{ at: Millis }>>; fallback: boolean }) {
  const router = useRouter();
  const stepUp = useStepUp();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button type="button" variant="quiet" size="sm" icon="none" onClick={() => setOpen(true)}>
        Remove the saved keys
      </Button>
      <ConfirmDialog
        open={open}
        onCancel={() => setOpen(false)}
        title="Remove the saved Stripe keys?"
        body={fallback ? "Haven goes back to the keys in the server settings. The webhook Haven set up in Stripe is removed too." : "Card payments stop: donors see bank and mobile-money details instead. The webhook Haven set up in Stripe is removed too."}
        confirmLabel="Remove the keys"
        tone="danger"
        requireText="remove"
        busy={pending}
        onConfirm={() =>
          start(async () => {
            const r = await remove();
            if (!r.ok && r.error.kind === "forbidden" && r.error.paths?.includes("step-up")) {
              stepUp();
              return;
            }
            setOpen(false);
            toast({ title: r.ok ? "The saved keys are removed" : r.error.kind === "validation" ? "Please try again." : r.error.message, tone: r.ok ? "success" : "danger" });
            if (r.ok) router.refresh();
          })
        }
      />
    </>
  );
}

const dayFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

/** Send another super admin a secure link to paste the keys, and see the links that still work. */
export function StripeKeyLinks({
  recipients,
  links,
  send,
  cancel,
}: {
  recipients: KeyRecipientDTO[];
  links: KeyLinkDTO[];
  send: (uids: string[]) => Promise<ActionResult<{ sent: number }>>;
  cancel: (id: string) => Promise<ActionResult<{ id: string }>>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [chosen, setChosen] = useState<string[]>(recipients.map((r) => r.uid));
  const [pending, start] = useTransition();
  const [cancelling, setCancelling] = useState<string | null>(null);

  return (
    <div className="grid gap-5">
      {recipients.length ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const r = await send(chosen);
              if (r.ok) {
                toast({ title: r.data.sent === 1 ? "Secure link sent" : `${r.data.sent} secure links sent`, tone: "success" });
                router.refresh();
              } else toast({ title: r.error.kind === "validation" ? (Object.values(r.error.fields)[0] ?? "Choose who should get the link.") : r.error.message, tone: "danger" });
            });
          }}
        >
          <fieldset className="grid gap-2">
            <legend className="text-[15px] font-bold text-ink">Send it to</legend>
            {recipients.map((p) => (
              <Checkbox
                key={p.uid}
                name="recipients"
                value={p.uid}
                label={
                  <>
                    <span className="font-bold">{p.name}</span> <span className="text-body">({p.email})</span>
                  </>
                }
                checked={chosen.includes(p.uid)}
                onChange={(e) => setChosen((xs) => (e.target.checked ? [...xs, p.uid] : xs.filter((x) => x !== p.uid)))}
              />
            ))}
          </fieldset>
          <div>
            <Button type="submit" variant="outline" size="sm" icon="send" iconFirst loading={pending} disabled={pending || !chosen.length}>
              Send the secure link
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-[14.5px] text-body">
          There’s no other super admin yet. Invite one in{" "}
          <Link href="/admin/team" className="font-bold text-forest underline-offset-4 hover:underline">
            Team
          </Link>{" "}
          first, then send them the link.
        </p>
      )}

      {links.length ? (
        <div className="grid gap-2">
          <p className="text-[15px] font-bold text-ink">Links that still work</p>
          <ul className="grid gap-2">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 rounded-[16px] border border-line p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-mint text-forest">
                  <Link2 aria-hidden className="size-4" />
                </span>
                <span className="min-w-0 flex-1 basis-56 text-[14px] text-body">
                  <span className="block font-bold text-ink">{l.recipientName}</span>
                  Sent {dayFmt.format(l.createdAt)} by {l.sentByName} · works until {dayFmt.format(l.expiresAt)} · {l.opens === 0 ? "not opened yet" : `opened ${l.opens === 1 ? "once" : `${l.opens} times`}`}
                  {l.savedAt ? ` · keys saved ${dayFmt.format(l.savedAt)}` : ""}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  icon="none"
                  className="h-9 px-4"
                  loading={cancelling === l.id}
                  disabled={cancelling !== null}
                  onClick={() => {
                    setCancelling(l.id);
                    void cancel(l.id).then((r) => {
                      setCancelling(null);
                      toast({ title: r.ok ? "That link no longer works" : r.error.kind === "validation" ? "Please try again." : r.error.message, tone: r.ok ? "success" : "danger" });
                      router.refresh();
                    });
                  }}
                >
                  Cancel link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
