"use client";

import { Checkbox } from "@/components/ui/form/Checkbox";
import { ROLE_LABEL, VIEWER_SCOPE_LABEL } from "@/lib/model/labels";
import { ROLES, VIEWER_SCOPES, type Role, type ViewerScope } from "@/lib/model/permissions";
import { cn } from "@/lib/cn";

/**
 * What someone does here (admin-ux §6.14): one card per role with its plain one-line meaning, and,
 * for a Viewer, which parts they can look at. Used by the invite sheet and a person's page.
 */
export function RolePicker({
  roles,
  scopes,
  onRoles,
  onScopes,
  error,
  scopesError,
  disabled,
  idPrefix = "role",
}: {
  roles: Role[];
  scopes: ViewerScope[];
  onRoles: (r: Role[]) => void;
  onScopes: (s: ViewerScope[]) => void;
  error?: string;
  scopesError?: string;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="grid gap-4">
      <fieldset aria-describedby={error ? `${idPrefix}-error` : undefined}>
        <legend className="text-[15px] font-bold text-ink">What will they do here?</legend>
        <p className="mt-0.5 text-[14px] text-body">Choose one or more. They only see the parts their roles open.</p>
        <ul className="mt-3 grid gap-2">
          {ROLES.map((r) => {
            const on = roles.includes(r);
            return (
              <li key={r} className={cn("rounded-2xl border px-3.5 py-3 transition-colors", on ? "border-forest bg-mint/50" : "border-line bg-white")}>
                <Checkbox
                  name={`${idPrefix}-${r}`}
                  value={r}
                  label={ROLE_LABEL[r].name}
                  hint={ROLE_LABEL[r].oneLine}
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => onRoles(e.target.checked ? [...roles, r] : roles.filter((x) => x !== r))}
                />
              </li>
            );
          })}
        </ul>
        {error ? (
          <p id={`${idPrefix}-error`} className="mt-2 text-[14px] font-semibold text-danger">
            {error}
          </p>
        ) : null}
      </fieldset>
      {roles.includes("viewer") ? (
        <fieldset>
          <legend className="text-[15px] font-bold text-ink">What can they look at?</legend>
          <div className="mt-2 grid gap-2">
            {VIEWER_SCOPES.map((s) => (
              <Checkbox
                key={s}
                name={`${idPrefix}-scope-${s}`}
                value={s}
                label={VIEWER_SCOPE_LABEL[s]}
                checked={scopes.includes(s)}
                disabled={disabled}
                onChange={(e) => onScopes(e.target.checked ? [...scopes, s] : scopes.filter((x) => x !== s))}
              />
            ))}
          </div>
          {scopesError ? <p className="mt-2 text-[14px] font-semibold text-danger">{scopesError}</p> : null}
        </fieldset>
      ) : null}
    </div>
  );
}

/** After a "please confirm it's you" refusal, go to /admin/confirm and come back here. */
export function isStepUp(error: { kind: string; paths?: string[] }): boolean {
  return error.kind === "forbidden" && Boolean(error.paths?.includes("step-up"));
}

export function confirmHref(): string {
  return `/admin/confirm?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
}
