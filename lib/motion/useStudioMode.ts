"use client";

import { useSyncExternalStore } from "react";

// Studio mode (admin-ux §6.10): inside the website studio's preview iframe the bridge marks
// `<html data-studio>`. Autoplaying carousels pause and smooth scrolling stays off, so the slide
// staff are editing doesn't move away from under them.

function subscribe(onChange: () => void): () => void {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-studio"] });
  return () => obs.disconnect();
}

/** True inside the studio preview (also from the first render, via the `?studio=1` URL). */
export function isStudioDocument(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.hasAttribute("data-studio") || new URLSearchParams(window.location.search).get("studio") === "1";
}

export function useStudioMode(): boolean {
  return useSyncExternalStore(subscribe, isStudioDocument, () => false);
}
