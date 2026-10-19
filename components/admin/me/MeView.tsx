"use client";

import { useState, useTransition } from "react";
import { Laptop, LogOut, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/admin/auth/PasswordInput";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import { relativeTime } from "@/lib/admin/format";
import type { ActionResult } from "@/lib/forms/types";
import type { NotificationDelivery, NotificationTopic } from "@/lib/model/domain/staff";
import type { MeDTO, MeInput } from "@/lib/server/dal/staff";

type Save = (input: MeInput) => Promise<ActionResult<{ version: number }>>;
type Password = (current: string, next: string) => Promise<ActionResult<{ version: number }>>;
type SignOut = (id: string) => Promise<ActionResult<{ count: number }>>;
type SignOutOthers = () => Promise<ActionResult<{ count: number }>>;

const ZONES = [
  ["Africa/Banjul", "The Gambia, Senegal (GMT)"],
  ["Africa/Lagos", "Nigeria, Cameroon (WAT)"],
  ["Africa/Accra", "Ghana (GMT)"],
  ["Africa/Nairobi", "Kenya, Uganda, Ethiopia (EAT)"],
  ["Africa/Cairo", "Egypt"],
  ["Asia/Amman", "Jordan"],
  ["Asia/Beirut", "Lebanon"],
  ["Asia/Riyadh", "Saudi Arabia, Yemen"],
  ["Asia/Dubai", "UAE, Oman"],
  ["Asia/Karachi", "Pakistan"],
  ["Asia/Kolkata", "India, Sri Lanka"],
  ["Asia/Kathmandu", "Nepal"],
  ["Asia/Dhaka", "Bangladesh"],
  ["Asia/Bangkok", "Thailand, Cambodia"],
  ["Asia/Jakarta", "Indonesia (Jakarta)"],
  ["Asia/Manila", "Philippines"],
  ["Europe/London", "United Kingdom"],
  ["UTC", "UTC"],
] as const;

const TOPICS: Array<{ id: NotificationTopic; label: string; hint: string }> = [
  { id: "inbox", label: "New messages and requests", hint: "When something lands in your inbox." },
  { id: "handoffs", label: "When someone hands you something", hint: "A request, gift or volunteer passed to you." },
  { id: "sessions", label: "Counselling sessions", hint: "Bookings and changes to your sessions." },
  { id: "drafts", label: "Drafts waiting for review", hint: "Posts and pages someone has asked you to check." },
];

const DELIVERY: Array<{ value: NotificationDelivery; label: string }> = [
  { value: "instant", label: "Straight away" },
  { value: "daily_digest", label: "Once a day" },
  { value: "off", label: "Off" },
];

function Card({ id, title, lead, children }: { id: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
      <h2 id={id} className="text-[18px] font-extrabold text-ink">
        {title}
      </h2>
      {lead ? <p className="mt-1 text-[14.5px] text-body">{lead}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Me (admin-ux §6.17): name, timezone, text size, emails, password, sign-in code and devices. */
export function MeView({ me, save, changePassword, signOutDevice, signOutOthers }: { me: MeDTO; save: Save; changePassword: Password; signOutDevice: SignOut; signOutOthers: SignOutOthers }) {
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState(me.name);
  const [timezone, setTimezone] = useState(me.timezone);
  const [textSize, setTextSize] = useState(me.textSize);
  const [prefs, setPrefs] = useState(me.prefs);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({});
  const zones: ReadonlyArray<readonly [string, string]> = ZONES.some(([z]) => z === me.timezone) ? ZONES : [[me.timezone, me.timezone], ...ZONES];
  const dirty = name !== me.name || timezone !== me.timezone || textSize !== me.textSize || TOPICS.some((t) => prefs[t.id] !== me.prefs[t.id]);
  const others = me.sessions.filter((s) => !s.current).length;

  const fail = (e: Extract<ActionResult<unknown>, { ok: false }>["error"], set: (f: Record<string, string>) => void) => {
    if (e.kind === "validation") set(e.fields);
    toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
  };

  const saveProfile = () =>
    start(async () => {
      const r = await save({ name, timezone, textSize, prefs });
      if (r.ok) {
        setErrors({});
        toast({ title: "Saved", tone: "success" });
      } else fail(r.error, setErrors);
    });

  const savePassword = () =>
    start(async () => {
      const r = await changePassword(current, next);
      if (r.ok) {
        setPwErrors({});
        setCurrent("");
        setNext("");
        toast({ title: "Your new password is saved", tone: "success" });
      } else fail(r.error, setPwErrors);
    });

  const out = (id: string) =>
    start(async () => {
      const r = await signOutDevice(id);
      if (r.ok) toast({ title: "That device is signed out", tone: "success" });
      else fail(r.error, () => undefined);
    });

  const outOthers = () =>
    start(async () => {
      const r = await signOutOthers();
      if (r.ok) toast({ title: r.data.count === 1 ? "Signed out on 1 other device" : `Signed out on ${r.data.count} other devices`, tone: "success" });
      else fail(r.error, () => undefined);
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid content-start gap-6">
        <Card id="me-profile" title="About you">
          <div className="mb-5 flex items-center gap-3">
            <Avatar name={name || me.name} uid={me.uid} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold text-ink">{me.email}</p>
              <p className="text-[13.5px] text-body">{me.roleNames.join(", ")}</p>
            </div>
          </div>
          <div className="grid gap-4">
            <Field name="me-name" label="Your name" hint="As the team sees it." error={errors.name}>
              <Input value={name} maxLength={80} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field name="me-timezone" label="Your timezone" hint="Times in Haven are shown in this timezone." error={errors.timezone}>
              <Select value={timezone} options={zones.map(([value, label]) => ({ value, label }))} onChange={(e) => setTimezone(e.target.value)} />
            </Field>
            <div>
              <Segmented
                label="Text size"
                density="admin"
                skin="donat"
                options={[
                  { value: "normal", label: "Standard" },
                  { value: "large", label: "Larger" },
                ]}
                value={textSize}
                onChange={(v) => setTextSize(v as "normal" | "large")}
              />
              <p className="mt-1.5 text-[13.5px] text-body">Larger text across the team space, on every device you use.</p>
            </div>
          </div>
        </Card>

        <Card id="me-emails" title="Emails from Haven" lead="Choose when we email you. You’ll still see everything here.">
          <ul className="grid gap-4">
            {TOPICS.map((t) => {
              const locked = me.lockedTopics.includes(t.id);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="text-[15px] font-bold text-ink">{t.label}</p>
                    <p className="text-[13.5px] text-body">{locked ? "Safeguarding officers always get these, so concerns are never missed." : t.hint}</p>
                  </div>
                  <Segmented
                    label={t.label}
                    density="admin"
                    skin="donat"
                    options={DELIVERY.map((d) => ({ ...d, disabled: locked && d.value === "off" }))}
                    value={prefs[t.id]}
                    onChange={(v) => setPrefs((p) => ({ ...p, [t.id]: v }))}
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+88px)] z-10 flex justify-end md:bottom-6">
          <Button type="button" variant="forest" icon="none" loading={pending} disabled={!dirty || pending} onClick={saveProfile} className="shadow-card">
            Save my changes
          </Button>
        </div>
      </div>

      <aside className="grid content-start gap-6">
        <Card id="me-password" title="Your password">
          {me.mfa.practice ? (
            <div className="grid gap-4">
              <Field name="me-current" label="Current password" error={pwErrors.current}>
                <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              </Field>
              <Field name="me-next" label="New password" hint="At least 12 characters." error={pwErrors.next}>
                <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
              </Field>
              <Button type="button" variant="outline" size="sm" icon="none" disabled={pending || !current || next.length < 12} onClick={savePassword}>
                Change my password
              </Button>
            </div>
          ) : (
            <p className="text-[14.5px] text-body">To change it, sign out and choose “Forgot your password?”. We’ll email you a link.</p>
          )}
          {me.mfa.required ? (
            <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-body">
              <ShieldCheck aria-hidden className="size-4 text-forest" /> You finish signing in with a code we email you.
            </p>
          ) : null}
        </Card>

        <Card id="me-devices" title="Where you’re signed in">
          <ul className="grid gap-3">
            {me.sessions.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <Laptop aria-hidden className="size-4 shrink-0 text-body" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-bold text-ink">{s.device}</p>
                  <p className="text-[13px] text-body">{s.current ? "This device" : `Last used ${relativeTime(s.lastSeenAt, me.now)}`}</p>
                </div>
                {!s.current ? (
                  <button type="button" disabled={pending} onClick={() => out(s.id)} className="inline-flex h-9 shrink-0 items-center rounded-full border border-line px-3 text-[13.5px] font-bold text-ink hover:border-forest disabled:opacity-50">
                    Sign out
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {others > 0 ? (
            <button type="button" disabled={pending} onClick={outOthers} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-[14.5px] font-bold text-forest hover:underline disabled:opacity-50">
              <LogOut aria-hidden className="size-4" /> Sign out everywhere else
            </button>
          ) : null}
        </Card>
      </aside>
    </div>
  );
}
