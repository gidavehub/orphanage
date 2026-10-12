"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { readToPreview, type SlotBox, type ToStudio } from "@/lib/studio/bridge";

/** The box a `display:contents` slot draws on screen: the union of its children's boxes. */
function boxOf(slot: Element): DOMRect | null {
  let top = Infinity;
  let left = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const child of Array.from(slot.children)) {
    const r = child.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    top = Math.min(top, r.top);
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  return top === Infinity ? null : new DOMRect(left, top, right - left, bottom - top);
}

function slotsOnPage(): SlotBox[] {
  return Array.from(document.querySelectorAll("[data-studio-slot]")).flatMap((el) => {
    const b = boxOf(el);
    return b ? [{ id: el.getAttribute("data-studio-slot")!, top: Math.round(b.top + window.scrollY), height: Math.round(b.height) }] : [];
  });
}

/**
 * The studio's in-page bridge (PLAN D62; admin-ux §6.10). Rendered only in Draft Mode, by
 * StudioBridgeSlot inside `<Suspense>`, and only acts inside the studio iframe (`?studio=1`):
 * marks `<html data-studio>` (reveals stay visible, carousels pause, Lenis stays off), draws a dashed
 * marigold outline and an "✎ Edit …" badge over the hovered section without touching the layout,
 * and speaks lib/studio/bridge.ts with the admin page (ready · edit ⇄ refresh · scrollTo · highlight).
 */
export function StudioBridge() {
  const studio = useSearchParams().get("studio") === "1";
  const pathname = usePathname();
  const router = useRouter();
  const [hover, setHover] = useState<{ id: string; box: DOMRect } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});

  const post = (msg: ToStudio) => {
    if (window.parent !== window) window.parent.postMessage(msg, window.location.origin);
  };

  useEffect(() => {
    if (!studio) return;
    const root = document.documentElement;
    root.setAttribute("data-studio", "");
    return () => root.removeAttribute("data-studio");
  }, [studio]);

  // Tell the studio which sections this page has (after paint, and again after a refresh).
  useEffect(() => {
    if (!studio) return;
    const send = () => post({ t: "haven:ready", path: pathname, slots: slotsOnPage() });
    const id = window.setTimeout(send, 300);
    return () => window.clearTimeout(id);
  }, [studio, pathname]);

  useEffect(() => {
    if (!studio) return;
    const onMessage = (e: MessageEvent) => {
      const m = readToPreview(e);
      if (!m) return;
      if (m.t === "haven:refresh") {
        router.refresh();
        window.setTimeout(() => post({ t: "haven:ready", path: window.location.pathname, slots: slotsOnPage() }), 900);
      } else if (m.t === "haven:scrollTo") {
        const el = document.querySelector(`[data-studio-slot="${CSS.escape(m.id)}"]`);
        const b = el ? boxOf(el) : null;
        if (b) window.scrollTo({ top: Math.max(0, b.top + window.scrollY - 80), behavior: "smooth" });
      } else if (m.t === "haven:highlight") {
        setPinned(m.id);
      } else if (m.t === "haven:labels") {
        setLabels(m.labels);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [studio, router]);

  // The hovered (or highlighted) section's outline follows scrolling and resizing.
  useEffect(() => {
    if (!studio) return;
    const onMove = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("[data-studio-badge]")) return;
      const slot = target?.closest?.("[data-studio-slot]");
      if (!slot) return setHover(null);
      const box = boxOf(slot);
      if (box) setHover({ id: slot.getAttribute("data-studio-slot")!, box });
    };
    const onScroll = () => setHover((h) => {
      if (!h) return h;
      const el = document.querySelector(`[data-studio-slot="${CSS.escape(h.id)}"]`);
      const box = el ? boxOf(el) : null;
      return box ? { id: h.id, box } : null;
    });
    document.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousemove", onMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [studio]);

  if (!studio) return null;
  const pinnedEl = pinned ? document.querySelector(`[data-studio-slot="${CSS.escape(pinned)}"]`) : null;
  const shown = hover ?? (pinnedEl && pinned ? { id: pinned, box: boxOf(pinnedEl) } : null);
  if (!shown?.box) return null;
  const { box, id } = shown;
  const label = labels[id] ?? "this section";
  return (
    <div aria-hidden={false} className="pointer-events-none fixed inset-0 z-[70]">
      <div
        className="absolute rounded-[10px] border-2 border-dashed border-marigold"
        style={{ top: box.top - 4, left: Math.max(2, box.left - 4), width: Math.min(window.innerWidth - 4, box.width + 8), height: box.height + 8 }}
      />
      <button
        type="button"
        data-studio-badge=""
        onClick={() => post({ t: "haven:edit", id })}
        className="pointer-events-auto absolute inline-flex h-10 items-center gap-1.5 rounded-full bg-marigold px-4 text-[14px] font-bold text-night shadow-lg hover:bg-forest hover:text-white"
        style={{ top: Math.max(8, Math.min(window.innerHeight - 52, box.top + 12)), left: Math.max(8, Math.min(window.innerWidth - 220, box.right - 210)) }}
      >
        ✎ Edit {label}
      </button>
    </div>
  );
}
