import "server-only";

// Builds the projects pages' view data from the public readers (lib/content/public.ts): tiles with
// their programme, place, dates and the linked cause's funding (figures only when they may be shown,
// D38 + D46). Field by field, never a spread of the stored item.

import { getCause, getLatestPosts, getPost, getPosts, getProgrammes, getProject, getProjects, type CauseView, type PostCard, type ProjectView } from "@/lib/content/public";
import type { ProgrammeId } from "@/lib/model/enums";
import { countryName } from "@/lib/countries";
import { PROGRAMME_LABEL } from "@/lib/model/labels";
import type { UiImage } from "@/lib/model/ui";
import { projectWhen, type ProjectFunding, type ProjectTileData } from "@/components/public/projects/model";

/** The image fields a client tile needs (no asset ids). */
export function tileImage(img: ProjectView["image"]): UiImage {
  if (img.type !== "image") return { src: "", alt: "" };
  return {
    src: img.src,
    alt: img.decorative ? "" : img.alt,
    ...(img.width ? { width: img.width } : {}),
    ...(img.height ? { height: img.height } : {}),
    ...(img.blurDataURL ? { blurDataURL: img.blurDataURL } : {}),
    ...(img.focal ? { focal: img.focal } : {}),
    ...(img.decorative ? { decorative: true } : {}),
    illustrative: img.illustrative,
  };
}

/** The funding facts of a linked cause. */
export function fundingOf(cause: CauseView | null): ProjectFunding | null {
  if (!cause) return null;
  return {
    causeTitle: cause.title,
    href: cause.href,
    figures: cause.showFigures && cause.goal > 0 ? { raised: cause.raised, goal: cause.goal, percent: cause.percent, currency: cause.currency } : null,
    closed: cause.closed,
  };
}

/** One project as a tile. */
export async function projectTile(p: ProjectView): Promise<ProjectTileData> {
  const [cause, programmes] = await Promise.all([p.causeSlug ? getCause(p.causeSlug) : Promise.resolve(null), getProgrammes()]);
  const programme = p.programmeId ? programmes.find((x) => x.id === p.programmeId) : undefined;
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    summary: p.summary ?? "",
    image: tileImage(p.image),
    status: p.status,
    programmeId: p.programmeId ?? null,
    programmeLabel: p.programmeId ? (programme?.title ?? PROGRAMME_LABEL[p.programmeId]) : null,
    place: p.place ? { code: p.place, name: countryName(p.place) } : null,
    when: projectWhen(p.status, p.startedAt, p.endedAt),
    href: p.href,
    funding: fundingOf(cause),
  };
}

/** Every live project as a tile, in the editors' order. */
export async function projectTiles(o: { exclude?: string } = {}): Promise<ProjectTileData[]> {
  const cards = await getProjects();
  const views = await Promise.all(cards.filter((c) => c.slug !== o.exclude).map((c) => getProject(c.slug)));
  return Promise.all(views.filter((v): v is ProjectView => !!v).map(projectTile));
}

/** News about a programme (newest first, up to `n`), topped up with the latest posts so the row is never empty. */
export async function postsAboutProgramme(programmeId: ProgrammeId | null, n = 3): Promise<PostCard[]> {
  const { items } = await getPosts({ page: 1, pageSize: 24 });
  const matching: PostCard[] = [];
  if (programmeId) {
    const full = await Promise.all(items.map((c) => getPost(c.slug)));
    items.forEach((c, i) => {
      if (full[i]?.programmeIds.includes(programmeId)) matching.push(c);
    });
  }
  if (matching.length >= n) return matching.slice(0, n);
  const latest = await getLatestPosts(n + matching.length);
  for (const p of latest) {
    if (matching.length >= n) break;
    if (!matching.some((m) => m.slug === p.slug)) matching.push(p);
  }
  return matching;
}
