"use client";

// Connection state for the team space (PLAN D12; admin-ux §3.7): navigator.onLine plus failed-fetch
// detection, so the offline ribbon also appears when the network is up but Haven can't be reached.

import { useEffect, useState } from "react";

const listeners = new Set<(online: boolean) => void>();
let fetchFailed = false;

/** Call when a same-origin request fails with a network error (e.g. the pulse); clears on success. */
export function reportNetwork(ok: boolean): void {
  if (fetchFailed === !ok) return;
  fetchFailed = !ok;
  for (const l of listeners) l(!fetchFailed && (typeof navigator === "undefined" || navigator.onLine));
}

/** True while the browser is online and the last request reached Haven. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine && !fetchFailed);
    update();
    listeners.add(setOnline);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      listeners.delete(setOnline);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
