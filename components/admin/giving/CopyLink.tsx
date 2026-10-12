"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

/** Copies a cause's shareable donate link. */
export function CopyLink({ href }: { href: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(new URL(href, window.location.origin).toString()).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        });
      }}
      className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13.5px] font-bold text-ink hover:border-forest"
    >
      {done ? <Check aria-hidden className="size-4 text-forest" /> : <Link2 aria-hidden className="size-4" />} {done ? "Copied" : "Copy link"}
    </button>
  );
}
