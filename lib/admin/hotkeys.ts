"use client";

// Keyboard shortcuts for the team space (admin-ux §6.3). "g" then a letter goes to a place; "/"
// focuses the page's own search field when it has one. Ignored while typing in a field. List pages
// register their own row keys (j/k/o/t/l…) on top of these.

import { useEffect } from "react";

/** "g" then … → path. */
export const GO_KEYS: Record<string, string> = {
  t: "/admin",
  i: "/admin/inbox",
  r: "/admin/requests",
  g: "/admin/giving",
  c: "/admin/counselling",
  w: "/admin/website",
  p: "/admin/posts",
};

export function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Registers the "g then …" chords; `go` navigates (router.push). */
export function useGoChords(go: (href: string) => void, allowed: (href: string) => boolean): void {
  useEffect(() => {
    let armedAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === "/" && !armedAt) {
        const search = document.querySelector<HTMLInputElement>("[data-page-search]");
        if (search) {
          e.preventDefault();
          search.focus();
        }
        return;
      }
      if (armedAt && Date.now() - armedAt < 1200) {
        armedAt = 0;
        const href = GO_KEYS[key];
        if (href && allowed(href)) {
          e.preventDefault();
          go(href);
        }
        return;
      }
      armedAt = key === "g" ? Date.now() : 0;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, allowed]);
}
