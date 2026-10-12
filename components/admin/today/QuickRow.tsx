"use client";

import { useRouter } from "next/navigation";
import { CalendarClock, FilePlus, FileText, Heart, NotebookPen, PenLine, Phone, Search, ShieldAlert, Upload, UserPlus, type LucideIcon } from "lucide-react";
import { useShell } from "@/components/admin/shell/ShellContext";
import { openGlobalSheet } from "@/components/admin/shell/SheetHost";
import { cn } from "@/lib/cn";

const ICONS: Record<string, LucideIcon> = { PenLine, Heart, Phone, ShieldAlert, CalendarClock, NotebookPen, FileText, FilePlus, Upload, UserPlus };

/**
 * Today's quick row (admin-ux §6.2): up to four role-filtered actions that open their sheet, then
 * Find. A row of pills on desktop, a 2×2 grid of tiles on phones.
 */
export function QuickRow({ className }: { className?: string }) {
  const { quickActions, openPanel, viewer } = useShell();
  const router = useRouter();
  const readOnly = viewer.roles.length === 1 && viewer.roles[0] === "viewer";
  const actions = readOnly ? [] : quickActions.slice(0, 4);
  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:flex sm:flex-wrap", className)}>
      {actions.map((a) => {
        const Icon = ICONS[a.icon] ?? PenLine;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => openGlobalSheet(router, a.id)}
            className="flex min-h-[64px] items-center gap-3 rounded-[20px] bg-white px-4 py-3 text-left text-[15px] font-bold text-ink shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-card focus-forest sm:min-h-12 sm:rounded-full sm:py-2"
          >
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-mint text-forest sm:size-8">
              <Icon className="size-[18px]" strokeWidth={2.25} />
            </span>
            <span className="leading-snug">{a.label}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => openPanel("find")}
        className="flex min-h-[64px] items-center gap-3 rounded-[20px] border border-line bg-cream px-4 py-3 text-left text-[15px] font-bold text-ink transition-colors hover:border-forest focus-forest sm:min-h-12 sm:rounded-full sm:py-2"
      >
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-forest sm:size-8">
          <Search className="size-[18px]" strokeWidth={2.25} />
        </span>
        <span>
          Find… <kbd className="ml-1 hidden rounded-md border border-line bg-white px-1.5 py-0.5 font-grotesk text-[12px] font-semibold text-body sm:inline">Ctrl K</kbd>
        </span>
      </button>
    </div>
  );
}
