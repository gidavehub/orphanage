"use client";

import { useRouter } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";

/** Opens the global "Book a session" sheet (`?do=book-session`). */
export function BookSessionButton({ supportRef }: { supportRef?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => openGlobalSheet(router, "book-session", supportRef ? { ref: supportRef } : undefined)}
      className="inline-flex h-11 items-center gap-2 rounded-full bg-forest px-5 text-[15px] font-bold text-white hover:bg-deep"
    >
      <CalendarPlus aria-hidden className="size-[18px]" /> Book a session
    </button>
  );
}
