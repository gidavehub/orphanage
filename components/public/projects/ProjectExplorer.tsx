"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Chips } from "@/components/ui/form/Chips";
import { Segmented } from "@/components/ui/form/Segmented";
import type { ProjectStatus } from "@/lib/content/schema";
import { PROJECT_STATUS_FILTER, PROJECT_STATUS_WORD, type ProjectTileData } from "./model";
import { ProjectTile } from "./ProjectTile";

type StatusFilter = "all" | ProjectStatus;

type Props = {
  projects: ProjectTileData[];
  /** Programme pills: only programmes that have projects. */
  programmes: Array<{ id: string; label: string }>;
  /** pages.projects → empty (CMS line under the empty-state title). */
  emptyBody: string;
};

const isStatus = (v: string | null): v is StatusFilter => !!v && PROJECT_STATUS_FILTER.some((o) => o.value === v);

/**
 * The /projects grid with its filters (public-pages §3.13): programme pills and a status switch. The
 * page stays fully static; the filter runs in the browser and is mirrored in the address
 * (`?programme=education&status=ongoing`) with history.replaceState, so a filtered view can be shared.
 * The query is read once after hydration from window.location (no path hooks, D4).
 */
export function ProjectExplorer({ projects, programmes, emptyBody }: Props) {
  const [filter, setFilter] = useState<{ programme: string; status: StatusFilter }>({ programme: "all", status: "all" });
  const { programme, status } = filter;

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const p = q.get("programme");
    const s = q.get("status");
    const next = { programme: p && programmes.some((x) => x.id === p) ? p : "all", status: isStatus(s) ? s : "all" };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting a shared link's filters once, after hydration
    if (next.programme !== "all" || next.status !== "all") setFilter(next);
  }, [programmes]);

  const sync = (nextProgramme: string, nextStatus: StatusFilter) => {
    const url = new URL(window.location.href);
    if (nextProgramme === "all") url.searchParams.delete("programme");
    else url.searchParams.set("programme", nextProgramme);
    if (nextStatus === "all") url.searchParams.delete("status");
    else url.searchParams.set("status", nextStatus);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const pick = (next: { programme: string; status: StatusFilter }) => {
    setFilter(next);
    sync(next.programme, next.status);
  };
  const pickProgramme = (v: string) => pick({ programme: v, status });
  const pickStatus = (v: StatusFilter) => pick({ programme, status: v });
  const reset = () => pick({ programme: "all", status: "all" });

  const shown = projects.filter((p) => (programme === "all" || p.programmeId === programme) && (status === "all" || p.status === status));
  const programmeLabel = programmes.find((p) => p.id === programme)?.label;
  const statusWord = status === "all" ? "" : PROJECT_STATUS_WORD[status].toLowerCase();
  const options = [{ value: "all", label: "All programmes", count: projects.length }, ...programmes.map((p) => ({ value: p.id, label: p.label, count: projects.filter((x) => x.programmeId === p.id).length }))];
  const emptyTitle = `No ${statusWord ? `${statusWord} ` : ""}projects${programmeLabel ? ` in ${programmeLabel}` : ""} yet.`;

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        {programmes.length > 1 ? (
          <Chips options={options} value={programme} onChange={pickProgramme} label="Filter projects by programme" tone="clay" scroll className="min-w-0 lg:flex-1" />
        ) : (
          <span />
        )}
        <Segmented options={PROJECT_STATUS_FILTER} value={status} onChange={pickStatus} label="Filter projects by status" skin="donat" className="w-full shrink-0 sm:max-w-[460px]" />
      </div>
      <p aria-live="polite" className="sr-only">
        {shown.length === 1 ? "Showing 1 project" : `Showing ${shown.length} projects`}
        {programmeLabel ? ` in ${programmeLabel}` : ""}
        {statusWord ? `, ${statusWord}` : ""}
      </p>

      {shown.length ? (
        <ul className="mt-10 grid gap-7 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((p, i) => (
            <li key={p.id} className="grid motion-safe:animate-[hero-rise_0.6s_var(--ease-out-expo)_both]" style={{ animationDelay: `${Math.min(i, 8) * 70}ms` }}>
              <ProjectTile project={p} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          art="sprig"
          title={emptyTitle}
          body={emptyBody}
          action={
            <Button variant="forest" icon="arrow" onClick={reset}>
              Show All Projects
            </Button>
          }
          className="mt-10"
        />
      )}
    </div>
  );
}
