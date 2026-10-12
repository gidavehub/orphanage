"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Check, Lock, Play, Search, Sparkles, Upload } from "lucide-react";
import type { MediaPickerItem } from "@/lib/model/dto";
import { cn } from "@/lib/cn";

export type MediaPickerProps = {
  /** The library, already filtered by the server to what this person may use. */
  items: MediaPickerItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  /** Limit to photos or videos. */
  kind?: "image" | "video" | "any";
  /** Where "Upload a new photo" goes (the media library or the upload sheet). */
  uploadHref?: string;
  /**
   * `child`: a real photo with a child in it cannot be chosen until written consent is recorded
   * (admin-ux §12 consent block; content-model §6.5). AI images are illustrative and need none.
   */
  requireConsentFor?: "child";
  /** Offer "No picture". */
  allowNone?: boolean;
  className?: string;
};

type Filter = "all" | "image" | "video" | "illustrative";

/** Why an item cannot be chosen here, or null. */
function blockedReason(item: MediaPickerItem, requireConsentFor?: "child"): string | null {
  if (item.status !== "active") return item.status === "withdrawn" ? "Consent withdrawn" : "Archived";
  if (item.consent === "withdrawn") return "Consent withdrawn";
  if (requireConsentFor === "child" && item.childInImage && !item.aiGenerated && item.consent !== "valid" && item.consent !== "not_required") {
    return "Needs consent";
  }
  return null;
}

/**
 * Choose a photo or video from the library (admin-ux §6.13; PLAN §5.5): a filterable grid (alt text
 * and captions), with the "Illustrative image" badge on AI images with people (D54) and the consent
 * gate for real photos of children. A radio group underneath, so it works with the keyboard.
 */
export function MediaPicker({ items, value, onChange, label = "Choose a picture", kind = "any", uploadHref, requireConsentFor, allowNone, className }: MediaPickerProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const name = useId();
  const searchId = useId();

  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();
    return items.filter((it) => {
      if (it.status === "withdrawn") return false;
      if (kind !== "any" && it.kind !== kind) return false;
      if (filter === "image" && it.kind !== "image") return false;
      if (filter === "video" && it.kind !== "video") return false;
      if (filter === "illustrative" && !it.illustrative) return false;
      if (query && !`${it.alt} ${it.caption ?? ""} ${it.id}`.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [items, kind, filter, q]);

  const filters: Array<{ value: Filter; label: string }> = [
    { value: "all", label: "All" },
    ...(kind === "any" ? ([{ value: "image", label: "Photos" }, { value: "video", label: "Videos" }] as const) : []),
    { value: "illustrative", label: "Illustrative" },
  ];

  return (
    <fieldset className={cn("grid min-w-0 gap-3", className)}>
      <legend className="text-[15px] font-bold text-ink">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="scrollbar-none flex gap-2 overflow-x-auto">
          {filters.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[13px] font-bold transition-colors",
                filter === f.value ? "bg-forest text-white" : "bg-white text-ink shadow-thumb hover:bg-mint",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex h-10 min-w-[180px] flex-1 items-center gap-2 rounded-full border-[1.5px] border-edge bg-white px-4 focus-within:border-forest focus-within:ring-4 focus-within:ring-forest/15 sm:flex-none">
          <Search aria-hidden className="size-4 text-body" strokeWidth={2.5} />
          <label htmlFor={searchId} className="sr-only">
            Search pictures
          </label>
          <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className="h-full min-w-0 flex-1 bg-transparent text-[16px] focus:outline-none" />
        </div>
      </div>

      {/* The scroll lives on a wrapper: a height-capped grid would shrink its rows (tiles have no min height). */}
      <div className="max-h-[460px] overflow-y-auto overscroll-contain rounded-control bg-white p-3 shadow-soft">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {allowNone ? (
          <label
            className={cn(
              "relative grid aspect-[4/3] cursor-pointer place-items-center rounded-tile border-2 border-dashed text-[14px] font-bold text-body transition-colors",
              value === null ? "border-forest bg-mint text-forest" : "border-line hover:bg-cream",
              "has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-forest",
            )}
          >
            <input type="radio" name={name} value="" aria-label="No picture" checked={value === null} onChange={() => onChange(null)} className="sr-only" />
            No picture
          </label>
        ) : null}
        {visible.map((it) => {
          const blocked = blockedReason(it, requireConsentFor);
          const checked = value === it.id;
          const thumb = it.kind === "video" ? (it.poster ?? null) : it.src;
          return (
            <label
              key={it.id}
              title={it.alt}
              className={cn(
                "group relative block aspect-[4/3] cursor-pointer overflow-hidden rounded-tile bg-pebble ring-offset-2 transition-shadow",
                checked && "ring-[3px] ring-forest",
                blocked && "cursor-not-allowed",
                "has-[input:focus-visible]:outline has-[input:focus-visible]:outline-[3px] has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-forest",
              )}
            >
              <input type="radio" name={name} value={it.id} aria-label={it.alt || `Picture ${it.id}`} checked={checked} disabled={!!blocked} onChange={() => onChange(it.id)} className="sr-only" />
              {thumb ? (
                <Image src={thumb} alt={it.alt} fill sizes="(min-width:1024px) 180px, 45vw" className={cn("object-cover transition-transform duration-300 group-hover:scale-[1.03]", blocked && "opacity-50 grayscale")} />
              ) : null}
              {it.kind === "video" ? (
                <span aria-hidden className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-night/75 text-white">
                  <Play className="size-3.5" fill="currentColor" strokeWidth={0} />
                </span>
              ) : null}
              {it.illustrative ? (
                <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-full bg-night/75 px-2 py-1 font-grotesk text-[11px] font-medium text-white">
                  <Sparkles aria-hidden className="size-3 text-marigold" strokeWidth={2.25} /> Illustrative
                </span>
              ) : null}
              {blocked ? (
                <span className="absolute inset-x-2 bottom-2 inline-flex items-center justify-center gap-1 rounded-full bg-white/95 px-2 py-1 font-grotesk text-[11px] font-semibold text-coral-800">
                  <Lock aria-hidden className="size-3" strokeWidth={2.75} /> {blocked}
                </span>
              ) : null}
              {checked ? (
                <span aria-hidden className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-forest text-white">
                  <Check className="size-4" strokeWidth={3.5} />
                </span>
              ) : null}
            </label>
          );
        })}
        {visible.length === 0 ? <p className="col-span-full px-2 py-6 text-center text-[14px] text-body">No pictures match.</p> : null}
      </div>
      </div>

      {requireConsentFor === "child" ? (
        <p className="text-[13px] leading-relaxed text-body">
          We can&rsquo;t put a photo of a real child live until a parent or guardian&rsquo;s written consent is recorded.
        </p>
      ) : null}
      {uploadHref ? (
        <Link href={uploadHref} className="inline-flex min-h-11 w-fit items-center gap-2 text-[15px] font-bold text-forest underline-offset-4 hover:underline">
          <Upload aria-hidden className="size-4" strokeWidth={2.5} /> Upload a new picture
        </Link>
      ) : null}
    </fieldset>
  );
}
