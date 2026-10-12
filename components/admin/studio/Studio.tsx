"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, ListTree, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { Segmented } from "@/components/ui/form/Segmented";
import { Select } from "@/components/ui/form/Select";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import { readToStudio, type ToPreview } from "@/lib/studio/bridge";
import type { StudioPage } from "@/lib/studio/registry";
import type { SectionDTO } from "@/lib/studio/server";
import { cn } from "@/lib/cn";
import { CollectionSheet, type CollectionActions } from "./CollectionSheet";
import { PublishSheet, type PublishActions } from "./PublishSheet";
import { SectionSheet } from "./SectionSheet";

type SaveDoc = (input: { id: string; baseVersion: number; data: unknown; intent: "draft" | "publish" }) => Promise<ActionResult<{ version: number; at: Millis }>>;

const DEVICES = { phone: 390, tablet: 820, desktop: 1280 } as const;
type Device = keyof typeof DEVICES;

/**
 * The website studio (admin-ux §6.10): the real page in an iframe (Draft Mode), the sections outline,
 * a section's sheet on click (from the outline or the "✎ Edit" badge in the preview), the device
 * switch and "Review & put live". The preview refreshes about a second after each draft save.
 */
export function Studio({
  pages,
  page,
  labels,
  drafts,
  canPublish,
  actions,
}: {
  pages: Array<{ key: string; label: string }>;
  page: StudioPage;
  labels: Record<string, string>;
  drafts: number;
  canPublish: boolean;
  actions: { loadSection: (id: string) => Promise<SectionDTO | null>; saveDoc: SaveDoc; collection: CollectionActions; publish: PublishActions };
}) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(900);
  // Phones (a narrow preview area) start at phone width until someone picks a view.
  const [chosen, setDevice] = useState<Device | null>(null);
  const device: Device = chosen ?? (width < 600 ? "phone" : "desktop");
  const [section, setSection] = useState<string | null>(null);
  const [collection, setCollection] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [outline, setOutline] = useState(true);
  const [outlineSheet, setOutlineSheet] = useState(false);
  const [onPage, setOnPage] = useState<Set<string> | null>(null);

  const post = useCallback((m: ToPreview) => frame.current?.contentWindow?.postMessage(m, window.location.origin), []);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e!.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const m = readToStudio(e);
      if (!m) return;
      if (m.t === "haven:ready") {
        setOnPage(new Set(m.slots.map((s) => s.id)));
        post({ t: "haven:labels", labels });
      } else if (m.t === "haven:edit") setSection(m.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [labels, post]);

  // "[" toggles the outline (admin-ux §6.10).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "[" && !(t && (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName)))) setOutline((x) => !x);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openSection = (id: string) => {
    setOutlineSheet(false);
    setSection(id);
    post({ t: "haven:scrollTo", id });
    post({ t: "haven:highlight", id });
  };
  const saved = () => {
    post({ t: "haven:refresh" });
    router.refresh();
  };

  const target = DEVICES[device];
  const scale = Math.min(1, width / target);
  const src = `/api/admin/studio/preview?path=${encodeURIComponent(page.path ?? "/")}`;

  const list = (
    <nav aria-label="Sections" className="grid gap-1">
      {page.sections.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => openSection(s.id)}
          className={cn("flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[14px] font-semibold text-ink hover:bg-sand", onPage && !onPage.has(s.id) && "text-body")}
        >
          <span className="min-w-0 truncate">{s.label}</span>
          <span aria-hidden className="text-body">✎</span>
        </button>
      ))}
      {page.collections.length ? <p className="mt-3 px-3 text-[12px] font-bold uppercase tracking-[0.06em] text-body">Lists</p> : null}
      {page.collections.map((c) => (
        <button key={c.name} type="button" onClick={() => (setOutlineSheet(false), setCollection(c.name))} className="flex items-center justify-between gap-2 rounded-[12px] px-3 py-2 text-left text-[14px] font-semibold text-ink hover:bg-sand">
          <span className="min-w-0 truncate">{c.label}</span>
          <span aria-hidden className="text-body">✎</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[22px] bg-white p-3 shadow-soft">
        <label htmlFor="studio-page" className="sr-only">
          Page
        </label>
        <div className="w-full sm:w-[240px]">
          <Select id="studio-page" density="admin" value={page.key} options={pages.map((p) => ({ value: p.key, label: p.label }))} onChange={(e) => router.push(`/admin/website/${e.target.value}`)} />
        </div>
        <div className="hidden sm:block">
          <Segmented
            label="View"
            density="admin"
            skin="donat"
            value={device}
            options={[
              { value: "phone", label: "Phone" },
              { value: "tablet", label: "Tablet" },
              { value: "desktop", label: "Desktop" },
            ]}
            onChange={(v) => setDevice(v)}
          />
        </div>
        <button type="button" onClick={() => setOutlineSheet(true)} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest xl:hidden">
          <ListTree aria-hidden className="size-4" /> Sections
        </button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {drafts ? (
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-umber">
              <span aria-hidden className="size-2 rounded-full bg-marigold" /> {drafts} change{drafts === 1 ? "" : "s"} not live yet
            </span>
          ) : (
            <span className="text-[14px] text-body">Everything is live</span>
          )}
          <Button type="button" variant={drafts ? "forest" : "outline"} size="sm" icon="none" onClick={() => setPublishing(true)}>
            Review &amp; put live
          </Button>
          {page.path ? (
            <a href={page.path} target="_blank" rel="noreferrer" aria-label="Open the live page" className="grid size-10 place-items-center rounded-full border border-line text-ink hover:border-forest">
              <ExternalLink aria-hidden className="size-4" />
            </a>
          ) : null}
        </div>
      </div>

      <div className={cn("grid gap-4", outline && "xl:grid-cols-[260px_minmax(0,1fr)]")}>
        {outline ? (
          <aside className="hidden self-start rounded-[22px] bg-white p-3 shadow-soft xl:sticky xl:top-24 xl:block">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-[15px] font-extrabold text-ink">Sections</p>
              <button type="button" aria-label="Hide sections ([)" onClick={() => setOutline(false)} className="grid size-8 place-items-center rounded-full text-body hover:bg-sand">
                <PanelLeftClose aria-hidden className="size-4" />
              </button>
            </div>
            {list}
          </aside>
        ) : (
          <button type="button" onClick={() => setOutline(true)} className="hidden h-10 w-fit items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink xl:inline-flex">
            <PanelLeftOpen aria-hidden className="size-4" /> Sections
          </button>
        )}
        <div ref={box} className="min-w-0">
          {page.path ? (
            <div className="overflow-hidden rounded-[22px] bg-white shadow-soft" style={{ height: `calc(${Math.round(78 / Math.max(scale, 0.4))}vh * ${scale})` }}>
              <iframe
                ref={frame}
                title={`Preview of the ${page.label} page`}
                src={src}
                className="origin-top-left border-0 bg-white"
                style={{ width: target, height: `${Math.round(78 / Math.max(scale, 0.4))}vh`, transform: `scale(${scale})`, marginLeft: scale < 1 ? 0 : Math.max(0, (width - target) / 2) }}
              />
            </div>
          ) : (
            <p className="rounded-[22px] bg-white p-6 text-[15px] text-body shadow-soft">This part has no page of its own to preview. Open a section from the list to edit it.</p>
          )}
        </div>
      </div>

      <Sheet open={outlineSheet} onClose={() => setOutlineSheet(false)} title="Sections" description={`The parts of the ${page.label} page you can change.`} size="sm">
        {list}
      </Sheet>
      <SectionSheet id={section} open={section !== null} onClose={() => (setSection(null), post({ t: "haven:highlight", id: null }))} load={actions.loadSection} save={actions.saveDoc} onSaved={saved} onOpenCollection={(n) => (setSection(null), setCollection(n))} />
      <CollectionSheet name={collection} open={collection !== null} onClose={() => setCollection(null)} actions={actions.collection} onSaved={saved} />
      <PublishSheet open={publishing} onClose={() => setPublishing(false)} actions={actions.publish} canPublish={canPublish} onDone={saved} />
    </div>
  );
}
