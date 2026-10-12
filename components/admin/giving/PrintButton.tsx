"use client";

import { Printer } from "lucide-react";

/** "Print or save as PDF" (the browser's print dialog). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[14px] font-bold text-white hover:bg-deep print:hidden">
      <Printer aria-hidden className="size-4" /> Print or save as PDF
    </button>
  );
}
