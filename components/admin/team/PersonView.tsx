"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { KeyRound, Laptop, Pause, Play, ShieldCheck, UserX } from "lucide-react";
import { confirmHref, isStepUp, RolePicker } from "@/components/admin/team/RolePicker";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Notice } from "@/components/ui/Notice";
import { useToast } from "@/components/ui/Toast";
import { relativeTime } from "@/lib/admin/format";
import type { ActionResult } from "@/lib/forms/types";
import type { Role, ViewerScope } from "@/lib/model/permissions";
import type { PersonDTO } from "@/lib/server/dal/staff";

type Act = ActionResult<{ version: number }>;
type Status = "active" | "suspended" | "deactivated";

const ASK: Record<Exclude<Status, "active">, { title: string; body: string; cta: string }> = {
  suspended: {
    title: "Pause their access?",
    body: "They’ll be signed out everywhere and can’t sign in until you restore it. Nothing they did is changed.",
    cta: "Pause access",
  },
  deactivated: {
    title: "Switch off their account?",
    body: "Use this when someone leaves. They’re signed out and can’t sign in. Their name stays on what they did, for the record.",
    cta: "Switch off the account",
  },
};

/** One person on the team (admin-ux §6.14): what they do, what that opens, their devices and their access. */
export function PersonView({
  p,
  saveRoles,
  setStatus,
  resetCode,
}: {
  p: PersonDTO;
  saveRoles: (uid: string, roles: string[], scopes: string[]) => Promise<Act>;
  setStatus: (uid: string, status: Status) => Promise<Act>;
  resetCode: (uid: string) => Promise<Act>;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [roles, setRoles] = useState<Role[]>(p.roles);
  const [scopes, setScopes] = useState<ViewerScope[]>(p.viewerScopes);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [asking, setAsking] = useState<Exclude<Status, "active"> | null>(null);
  const dirty = roles.slice().sort().join() !== p.roles.slice().sort().join() || scopes.slice().sort().join() !== p.viewerScopes.slice().sort().join();
  const first = p.name.split(" ")[0];

  const handle = (r: Act, ok: string) => {
    if (r.ok) {
      toast({ title: ok, tone: "success" });
      setErrors({});
      return true;
    }
    const e = r.error;
    if (isStepUp(e)) {
      toast({ title: "Please confirm it's you first", description: "Changing someone’s access needs a recent sign-in.", tone: "default" });
      router.push(confirmHref());
      return false;
    }
    if (e.kind === "validation") setErrors(e.fields);
    toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    return false;
  };

  const save = () => start(async () => void handle(await saveRoles(p.uid, roles, scopes), `${first}’s access is updated. We’ve emailed them.`));
  const changeStatus = (s: Status) =>
    start(async () => {
      const ok = handle(await setStatus(p.uid, s), s === "active" ? `${first} can sign in again` : s === "suspended" ? `${first}’s access is paused` : `${first}’s account is switched off`);
      if (ok) setAsking(null);
    });
  const reset = () => start(async () => void handle(await resetCode(p.uid), `${first} will set up a new sign-in code next time`));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-6">
        <section className="flex items-center gap-4 rounded-[26px] bg-white p-5 shadow-soft">
          <Avatar name={p.name} uid={p.uid} size={44} />
          <div className="min-w-0">
            <p className="text-[20px] font-extrabold text-ink">{p.name}</p>
            <p className="truncate text-[14.5px] text-body">{p.email}</p>
            <p className="mt-0.5 text-[13.5px] text-body">{p.lastSignInAt ? `Last signed in ${relativeTime(p.lastSignInAt, p.now)}` : "Hasn’t signed in yet"}</p>
          </div>
        </section>

        {p.status !== "active" ? (
          <Notice tone="warning" compact title={p.status === "suspended" ? "Access is paused" : "This account is switched off"}>
            {p.status === "suspended" ? `${first} can’t sign in until you restore their access.` : `${first} can’t sign in. You can switch the account back on if they return.`}
          </Notice>
        ) : null}

        <section aria-labelledby="roles-title" className="rounded-[26px] bg-white p-5 shadow-soft">
          <h2 id="roles-title" className="text-[18px] font-extrabold text-ink">
            What {first} does here
          </h2>
          {p.isLastSuperAdmin ? <p className="mt-1 text-[14px] font-semibold text-umber">{first} is the only super admin, so that role stays until someone else has it too.</p> : null}
          <div className="mt-4">
            <RolePicker idPrefix="person-role" roles={roles} scopes={scopes} onRoles={setRoles} onScopes={setScopes} error={errors.roles} disabled={pending || p.status === "deactivated"} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button type="button" variant="forest" size="sm" icon="none" loading={pending} disabled={!dirty || pending || roles.length === 0} onClick={save}>
              Save their access
            </Button>
            {dirty ? (
              <button
                type="button"
                onClick={() => {
                  setRoles(p.roles);
                  setScopes(p.viewerScopes);
                }}
                className="inline-flex h-10 items-center rounded-full px-4 text-[14px] font-bold text-body hover:bg-cream"
              >
                Undo changes
              </button>
            ) : null}
          </div>
        </section>
      </div>

      <aside className="grid content-start gap-6">
        <section aria-labelledby="keys-title" className="rounded-[26px] bg-white p-5 shadow-soft">
          <h2 id="keys-title" className="text-[16px] font-extrabold text-ink">
            What they can open
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            <li className="rounded-full bg-cream px-3 py-1 text-[13.5px] font-bold text-ink">Today</li>
            {p.keys.map((k) => (
              <li key={k} className="rounded-full bg-cream px-3 py-1 text-[13.5px] font-bold text-ink">
                {k}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="devices-title" className="rounded-[26px] bg-white p-5 shadow-soft">
          <h2 id="devices-title" className="text-[16px] font-extrabold text-ink">
            Signed in on
          </h2>
          {p.sessions.length ? (
            <ul className="mt-3 grid gap-2">
              {p.sessions.map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-[14.5px] text-ink">
                  <Laptop aria-hidden className="size-4 shrink-0 text-body" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.device}</span>
                  <span className="shrink-0 text-[13px] text-body">{relativeTime(s.lastSeenAt, p.now)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-body">Not signed in anywhere right now.</p>
          )}
          {p.mfa.required ? (
            <p className="mt-4 flex items-center gap-2 text-[14px] font-semibold text-body">
              <ShieldCheck aria-hidden className="size-4 text-forest" /> {p.mfa.enrolled ? "Uses a sign-in code" : "Sign-in code not set up yet"}
            </p>
          ) : null}
        </section>

        {!p.isMe ? (
          <section aria-labelledby="access-title" className="rounded-[26px] bg-white p-5 shadow-soft">
            <h2 id="access-title" className="text-[16px] font-extrabold text-ink">
              Their access
            </h2>
            <div className="mt-3 grid gap-2">
              {p.status === "active" ? (
                <>
                  <button type="button" disabled={pending || p.isLastSuperAdmin} onClick={() => setAsking("suspended")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-[14.5px] font-bold text-ink hover:border-forest disabled:opacity-50">
                    <Pause aria-hidden className="size-4" /> Pause their access
                  </button>
                  {p.mfa.required && p.mfa.enrolled ? (
                    <button type="button" disabled={pending} onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-[14.5px] font-bold text-ink hover:border-forest disabled:opacity-50">
                      <KeyRound aria-hidden className="size-4" /> Reset their sign-in code
                    </button>
                  ) : null}
                </>
              ) : (
                <button type="button" disabled={pending} onClick={() => changeStatus("active")} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-forest px-4 text-[14.5px] font-bold text-forest hover:bg-mint disabled:opacity-50">
                  <Play aria-hidden className="size-4" /> {p.status === "suspended" ? "Restore their access" : "Switch the account back on"}
                </button>
              )}
              {p.status !== "deactivated" ? (
                <button type="button" disabled={pending || p.isLastSuperAdmin} onClick={() => setAsking("deactivated")} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[14.5px] font-bold text-danger hover:bg-danger/10 disabled:opacity-50">
                  <UserX aria-hidden className="size-4" /> They’ve left Haven
                </button>
              ) : null}
            </div>
            {p.isLastSuperAdmin ? <p className="mt-2 text-[13.5px] text-body">Haven always needs one super admin who can sign in.</p> : null}
          </section>
        ) : null}
      </aside>

      <Modal
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking ? ASK[asking].title : ""}
        footer={
          <div className="flex flex-wrap justify-end gap-3">
            <Button type="button" variant="ghost" size="sm" icon="none" onClick={() => setAsking(null)}>
              Keep it as it is
            </Button>
            <Button type="button" variant="danger" size="sm" icon="none" loading={pending} disabled={pending} onClick={() => asking && changeStatus(asking)}>
              {asking ? ASK[asking].cta : ""}
            </Button>
          </div>
        }
      >
        <p className="text-[15px] leading-relaxed text-body">{asking ? ASK[asking].body : ""}</p>
      </Modal>
    </div>
  );
}
