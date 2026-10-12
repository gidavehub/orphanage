"use client";

import { useId, useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import type { StaffTone } from "@/lib/model/dto";
import { cn } from "@/lib/cn";

export type PersonOption = {
  uid: string;
  name: string;
  tone?: StaffTone;
  /** "Programme officer". */
  roleLabel?: string;
  /** Open records they look after, to spread the load ("5 open"). */
  openCount?: number;
  /** Unavailable people are listed but cannot be chosen ("On leave"). */
  disabledReason?: string;
};

export type PersonPickerProps = {
  label: string;
  /** Only people who may open the area (the server filters, admin-ux §9.2). */
  people: PersonOption[];
  value: string | null;
  onChange: (uid: string | null) => void;
  /** Offer "Nobody yet" to unassign. */
  allowNone?: boolean;
  /** Puts the signed-in person first as "Me". */
  meUid?: string;
  hint?: string;
  className?: string;
};

/**
 * Choose a staff member (admin-ux §9.2 PersonPicker): a filterable radio list with avatar, name, role
 * and open load. A native radio group underneath, so arrow keys, Space and screen readers work as
 * expected; the filter box only narrows the list.
 */
export function PersonPicker({ label, people, value, onChange, allowNone, meUid, hint, className }: PersonPickerProps) {
  const [q, setQ] = useState("");
  const name = useId();
  const filterId = useId();
  const hintId = useId();

  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    const sorted = [...people].sort((a, b) => Number(b.uid === meUid) - Number(a.uid === meUid) || a.name.localeCompare(b.name));
    return query ? sorted.filter((p) => `${p.name} ${p.roleLabel ?? ""}`.toLowerCase().includes(query)) : sorted;
  }, [people, q, meUid]);

  const option = (p: PersonOption | null) => {
    const id = p?.uid ?? "";
    const checked = (value ?? "") === id;
    const disabled = !!p?.disabledReason;
    return (
      <label
        key={id || "none"}
        className={cn(
          "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 transition-colors",
          "has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-forest",
          checked ? "bg-mint ring-2 ring-forest" : "hover:bg-cream",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <input
          type="radio"
          name={name}
          value={id}
          checked={checked}
          disabled={disabled}
          onChange={() => onChange(p ? p.uid : null)}
          className="sr-only"
        />
        {p ? <Avatar name={p.name} uid={p.uid} tone={p.tone} size={36} /> : <span aria-hidden className="grid size-9 place-items-center rounded-full bg-pebble font-grotesk text-[13px] text-body">–</span>}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold text-ink">{p ? (p.uid === meUid ? `Me (${p.name})` : p.name) : "Nobody yet"}</span>
          {p ? (
            <span className="block truncate font-grotesk text-[13px] text-body">
              {[p.roleLabel, typeof p.openCount === "number" ? `${p.openCount} open` : null, p.disabledReason].filter(Boolean).join(" · ")}
            </span>
          ) : null}
        </span>
        {checked ? <Check aria-hidden className="size-5 shrink-0 text-forest" strokeWidth={3} /> : null}
      </label>
    );
  };

  return (
    <fieldset className={cn("grid min-w-0 gap-2", className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="text-[15px] font-bold text-ink">{label}</legend>
      {hint ? (
        <p id={hintId} className="text-[14px] leading-relaxed text-body">
          {hint}
        </p>
      ) : null}
      {people.length > 6 ? (
        <div className="flex h-11 items-center gap-2 rounded-2xl border-[1.5px] border-edge bg-white px-4 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/15">
          <Search aria-hidden className="size-4 text-body" strokeWidth={2.5} />
          <label htmlFor={filterId} className="sr-only">
            Filter people
          </label>
          <input
            id={filterId}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Type a name"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent text-[16px] focus:outline-none"
          />
        </div>
      ) : null}
      <div className="grid max-h-[320px] gap-1 overflow-y-auto overscroll-contain rounded-control bg-white p-1.5 shadow-soft">
        {allowNone ? option(null) : null}
        {shown.map((p) => option(p))}
        {shown.length === 0 ? <p className="px-3 py-4 text-[14px] text-body">Nobody matches “{q.trim()}”.</p> : null}
      </div>
    </fieldset>
  );
}
