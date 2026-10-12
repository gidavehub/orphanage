// Shared shapes and words for the projects pages (public-pages §3.13, PLAN D50, D132). Plain data
// only, so the client explorer can import it.

import type { ProjectStatus } from "@/lib/content/schema";
import type { Currency, ProgrammeId } from "@/lib/model/enums";
import type { UiImage } from "@/lib/model/ui";

/** Public words for a project's status. (No model label exists; requested for lib/model/labels.ts.) */
export const PROJECT_STATUS_WORD: Record<ProjectStatus, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  upcoming: "Upcoming",
};

/** Status pill tones (Badge tones; every pair passes AA). */
export const PROJECT_STATUS_TONE: Record<ProjectStatus, "forest" | "neutral" | "marigold"> = {
  ongoing: "forest",
  completed: "neutral",
  upcoming: "marigold",
};

/** The status filter, in reading order. */
export const PROJECT_STATUS_FILTER: ReadonlyArray<{ value: "all" | ProjectStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "ongoing", label: "Ongoing" },
  { value: "completed", label: "Completed" },
  { value: "upcoming", label: "Upcoming" },
];

/** What a project raises, when it is linked to a cause (D50 `causeSlug`). */
export type ProjectFunding = {
  causeTitle: string;
  href: string;
  /** Only when finance may show the figures (D38, D46). */
  figures: { raised: number; goal: number; percent: number; currency: Currency } | null;
  closed: boolean;
};

/** One tile on /projects (serialisable for the client explorer). */
export type ProjectTileData = {
  id: string;
  title: string;
  subtitle: string;
  summary: string;
  image: UiImage;
  status: ProjectStatus;
  programmeId: ProgrammeId | null;
  programmeLabel: string | null;
  place: { code: string; name: string } | null;
  /** "March 2026 – June 2026", "Since May 2026", or null when no dates are set. */
  when: string | null;
  href: string;
  funding: ProjectFunding | null;
};

const monthYear = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

/** A project's dates in words, from Millis (deterministic: no clock read). */
export function projectWhen(status: ProjectStatus, startedAt?: number, endedAt?: number): string | null {
  const from = startedAt ? monthYear.format(new Date(startedAt)) : null;
  const to = endedAt ? monthYear.format(new Date(endedAt)) : null;
  if (from && to) return from === to ? from : `${from} – ${to}`;
  if (from) return status === "upcoming" ? `From ${from}` : status === "ongoing" ? `Since ${from}` : from;
  if (to) return `Until ${to}`;
  return null;
}
