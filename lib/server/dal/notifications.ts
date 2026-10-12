import "server-only";

// In-app updates for the signed-in person (admin-ux §3.6 Updates drawer; data-model notifications).
// A person only ever reads and marks their own notifications. Titles are written to be non-sensitive
// at creation time (notify.ts), so they are safe to list.

import type { StaffNotification } from "@/lib/model/domain/staff";
import type { Page } from "@/lib/model/dto";
import type { Millis } from "@/lib/model/enums";
import { requireStaff } from "@/lib/server/auth/session";
import { getStore } from "@/lib/server/db";
import { C, docPath, isValidDocumentId } from "@/lib/server/db/collections";
import type { Filter } from "@/lib/server/db/store";
import { clampLimit, pageOf } from "./_shared";

export type NotificationDTO = {
  id: string;
  kind: StaffNotification["kind"];
  title: string;
  /** Always an /admin/… path. */
  href: string;
  priority: "normal" | "urgent";
  read: boolean;
  createdAt: Millis;
};

function safeHref(href: unknown): string {
  return typeof href === "string" && /^\/admin(?:[/?#]|$)/.test(href) && !href.startsWith("//") ? href : "/admin";
}

/** Newest first, 25 per page; `unreadOnly` for the badge list. */
export async function listNotifications(opts: { cursor?: string | null; limit?: number; unreadOnly?: boolean } = {}): Promise<Page<NotificationDTO>> {
  const v = await requireStaff();
  const where: Filter[] = [{ field: "recipientUid", op: "==", value: v.uid }];
  if (opts.unreadOnly) where.push({ field: "read", op: "==", value: false });
  const page = await getStore().list<StaffNotification>(C.notifications, {
    where,
    orderBy: { field: "createdAt", dir: "desc" },
    limit: clampLimit(opts.limit),
    cursor: opts.cursor ?? null,
  });
  return pageOf(page, (n) =>
    n.recipientUid === v.uid
      ? {
          id: n.id,
          kind: n.kind,
          title: String(n.title ?? "").slice(0, 160),
          href: safeHref(n.href),
          priority: n.priority === "urgent" ? "urgent" : "normal",
          read: n.read === true,
          createdAt: n.createdAt,
        }
      : null,
  );
}

/** How many unread updates this person has (the bell's dot). */
export async function countUnreadNotifications(): Promise<number> {
  const v = await requireStaff();
  return getStore().count(C.notifications, [
    { field: "recipientUid", op: "==", value: v.uid },
    { field: "read", op: "==", value: false },
  ]);
}

/**
 * Marks updates as read: the given ids (only this person's are touched), or "all" unread ones
 * (up to 100 per call). Returns how many changed.
 */
export async function markRead(ids: string[] | "all"): Promise<{ updated: number }> {
  const v = await requireStaff();
  const store = getStore();
  const now = Date.now();
  let targets: string[] = [];
  if (ids === "all") {
    const page = await store.list<StaffNotification>(C.notifications, {
      where: [
        { field: "recipientUid", op: "==", value: v.uid },
        { field: "read", op: "==", value: false },
      ],
      orderBy: { field: "createdAt", dir: "desc" },
      limit: 100,
    });
    targets = page.items.map((n) => n.id);
  } else {
    const wanted = [...new Set(ids)].filter((id) => typeof id === "string" && isValidDocumentId(id)).slice(0, 100);
    if (wanted.length === 0) return { updated: 0 };
    const docs = await store.getMany<StaffNotification>(wanted.map((id) => docPath("notifications", id)));
    targets = docs.filter((d): d is NonNullable<typeof d> => !!d && d.recipientUid === v.uid && d.read !== true).map((d) => d.id);
  }
  if (targets.length === 0) return { updated: 0 };
  await store.batch((b) => {
    for (const id of targets) b.update(docPath("notifications", id), { read: true, readAt: now });
  });
  return { updated: targets.length };
}
