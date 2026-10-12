"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Reads prefill values from the URL (`?type=`, `?category=`…) once, client-side. Render it inside
 * `<Suspense fallback={null}>` so the form around it stays in the static shell (cacheComponents):
 * only this empty leaf waits for the request's search params.
 */
export function QueryPrefill({ keys, onValues }: { keys: readonly string[]; onValues: (values: Record<string, string>) => void }) {
  const params = useSearchParams();
  const done = useRef(false);
  const cb = useRef(onValues);

  useEffect(() => {
    cb.current = onValues;
  }, [onValues]);

  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const out: Record<string, string> = {};
    for (const k of keys) {
      const v = params.get(k);
      if (v && v.length <= 200) out[k] = v;
    }
    if (Object.keys(out).length) cb.current(out);
  }, [params, keys]);

  return null;
}
