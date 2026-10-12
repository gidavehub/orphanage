"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { isGlobalSheet, type GlobalSheet } from "@/lib/admin/access";
import { AddNoteSheet } from "@/components/admin/sheets/AddNoteSheet";
import { AddReportSheet } from "@/components/admin/sheets/AddReportSheet";
import { BookSessionSheet } from "@/components/admin/sheets/BookSessionSheet";
import { InviteSheet } from "@/components/admin/sheets/InviteSheet";
import { LogConcernSheet } from "@/components/admin/sheets/LogConcernSheet";
import { LogRequestSheet } from "@/components/admin/sheets/LogRequestSheet";
import { PostUpdateSheet } from "@/components/admin/sheets/PostUpdateSheet";
import { RecordGiftSheet } from "@/components/admin/sheets/RecordGiftSheet";
import { UploadMediaSheet } from "@/components/admin/sheets/UploadMediaSheet";
import { WriteArticleSheet } from "@/components/admin/sheets/WriteArticleSheet";

/** Props every global sheet takes (admin-ux §3.9). `params` holds the other query values (e.g. `ref`). */
export type GlobalSheetProps = {
  open: boolean;
  onClose: () => void;
  params: Record<string, string>;
};

const REGISTRY: Record<GlobalSheet, (props: GlobalSheetProps) => React.ReactNode> = {
  "record-gift": RecordGiftSheet,
  "log-request": LogRequestSheet,
  "log-concern": LogConcernSheet,
  "post-update": PostUpdateSheet,
  "write-article": WriteArticleSheet,
  "book-session": BookSessionSheet,
  "add-note": AddNoteSheet,
  "add-report": AddReportSheet,
  "upload-media": UploadMediaSheet,
  invite: InviteSheet,
};

// Set when the app itself pushed the ?do= URL, so closing can go back (and the phone's back button
// closes the sheet). A sheet opened from a shared link closes by replacing the URL instead.
let openedInApp = false;

/**
 * Opens an app-wide sheet on the current page: `?do=<sheet>` plus any extra values. Uses router.push
 * so the phone's back button closes it (admin-ux §3.9). Call from event handlers only.
 */
export function openGlobalSheet(router: ReturnType<typeof useRouter>, sheet: GlobalSheet, extra?: Record<string, string>): void {
  const url = new URL(window.location.href);
  url.searchParams.set("do", sheet);
  for (const [k, v] of Object.entries(extra ?? {})) url.searchParams.set(k, v);
  openedInApp = true;
  router.push(`${url.pathname}${url.search}`, { scroll: false });
}

/**
 * Renders the global sheet named by `?do=` (admin-ux §3.9). A path-hook leaf (PLAN D4): the shell
 * renders it inside `<Suspense fallback={null}>`. Every sheet's Server Actions check permissions
 * themselves, so an unknown or forbidden `?do=` can never do anything.
 */
export function SheetHost() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const raw = params.get("do");
  const id = isGlobalSheet(raw) ? raw : null;

  // Mount the sheet closed and open it a frame later. A <dialog> that mounts already open can
  // receive the asynchronous "close" event from its own first effect cleanup (React's dev
  // double-invoke, or Activity hide/show) after it re-opens, which would close it at once.
  const [openId, setOpenId] = useState<GlobalSheet | null>(null);
  const closing = useRef(false);
  useEffect(() => {
    closing.current = false;
    if (!id) return;
    const frame = requestAnimationFrame(() => setOpenId(id));
    return () => cancelAnimationFrame(frame);
  }, [id]);

  if (!id) return null;
  const Sheet = REGISTRY[id];
  const rest: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key !== "do") rest[key] = value;
  });

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setOpenId(null);
    if (openedInApp) {
      openedInApp = false;
      router.back();
      return;
    }
    const q = new URLSearchParams(params.toString());
    q.delete("do");
    const query = q.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return <Sheet key={id} open={openId === id} onClose={close} params={rest} />;
}
