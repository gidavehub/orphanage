"use client";

import { useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Spinner";
import type { Role } from "@/lib/model/permissions";
import { cn } from "@/lib/cn";

export type PracticeChip = { role: Role; name: string; roleLabel: string };

/**
 * Practice-mode one-tap sign-in (admin-ux §6.1; PLAN D90): one chip per role, each signing in as that
 * role's seeded `<role>@haven.test` account. Rendered only when the server says practice helpers are
 * allowed (local backend, not on Vercel); the action re-checks with devOnly().
 */
export function PracticeChips({ chips, action }: { chips: PracticeChip[]; action: (role: Role) => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Role | null>(null);

  return (
    <section aria-labelledby="practice-chips-title" className="rounded-2xl bg-sand p-4">
      <h2 id="practice-chips-title" className="flex items-center gap-2 font-grotesk text-[13px] font-semibold text-umber">
        <FlaskConical aria-hidden className="size-4" strokeWidth={2.25} />
        Practice mode · Try Haven as:
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <li key={c.role}>
            <button
              type="button"
              disabled={pending}
              aria-busy={pending && chosen === c.role}
              onClick={() => {
                setChosen(c.role);
                startTransition(async () => {
                  await action(c.role);
                });
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 text-left text-[14px] font-bold text-ink shadow-thumb transition-[background-color,transform] duration-200",
                "hover:bg-cream-2 active:scale-[0.98] disabled:opacity-60",
              )}
            >
              {pending && chosen === c.role ? (
                <span className="grid size-7 place-items-center">
                  <Spinner size={16} label={`Signing in as ${c.roleLabel}`} />
                </span>
              ) : (
                <Avatar name={c.name} uid={c.role} size={28} />
              )}
              <span>
                {c.name} <span className="font-semibold text-body">· {c.roleLabel}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
