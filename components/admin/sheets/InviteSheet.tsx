"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { confirmHref, isStepUp, RolePicker } from "@/components/admin/team/RolePicker";
import type { GlobalSheetProps } from "@/components/admin/shell/SheetHost";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Field } from "@/components/ui/form/Field";
import { Input } from "@/components/ui/form/Input";
import type { Role, ViewerScope } from "@/lib/model/permissions";
import { inviteAction } from "@/app/admin/(desk)/team/actions";

/**
 * Global sheet `?do=invite` (admin-ux §3.4, §6.14; PLAN D88): their name, email and what they'll do.
 * They get an email with a link that works for 72 hours, choose a password and land on Today.
 */
export function InviteSheet({ open, onClose }: GlobalSheetProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>([]);
  const [scopes, setScopes] = useState<ViewerScope[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () =>
    start(async () => {
      const r = await inviteAction({ displayName: name, email, roles, viewerScopes: scopes });
      if (r.ok) {
        toast({ title: `Invitation sent to ${name.trim().split(" ")[0]}`, description: "The link works for 72 hours.", tone: "success" });
        onClose();
        return;
      }
      const e = r.error;
      if (isStepUp(e)) {
        toast({ title: "Please confirm it's you first", description: "Inviting a super admin or safeguarding officer needs a recent sign-in.", tone: "default" });
        router.push(confirmHref());
        return;
      }
      if (e.kind === "validation") setErrors(e.fields);
      toast({ title: e.kind === "validation" ? (Object.values(e.fields)[0] ?? "Please check.") : e.message, tone: "danger" });
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Invite someone"
      description="They’ll get an email with a link to choose a password."
      dirty={Boolean(name || email || roles.length)}
      footer={
        <Button type="button" variant="forest" icon="none" block loading={pending} disabled={pending || name.trim().length < 2 || !email.includes("@") || roles.length === 0} onClick={submit}>
          Send the invitation
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field name="invite-name" label="Their name" error={errors.displayName}>
          <Input value={name} maxLength={80} autoComplete="off" onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field name="invite-email" label="Their email address" error={errors.email}>
          <Input type="email" inputMode="email" autoCapitalize="none" spellCheck={false} value={email} maxLength={254} autoComplete="off" onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <RolePicker idPrefix="invite-role" roles={roles} scopes={scopes} onRoles={setRoles} onScopes={setScopes} error={errors.roles} scopesError={errors.viewerScopes} />
      </div>
    </Sheet>
  );
}
