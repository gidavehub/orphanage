import type { MetadataRoute } from "next";
import { getCauses, getPolicies, getProgrammes, getPosts, getProjects } from "@/lib/content/public";
import { getResourceSlugs } from "@/lib/server/public/resources";
import { baseUrl } from "@/lib/server/url";

// /sitemap.xml (public-pages §7.3, PLAN D114): every public route plus every published slug, read
// through the cached getters, so a publish (which updates the collection tags) refreshes it. Posts
// carry their publish time as lastModified. Excluded: thank-you, search, unsubscribe, confirmations,
// receipts, manage, report links, /admin/** and /api/**, and every query-string variant.

type Entry = MetadataRoute.Sitemap[number];

const STATIC: Array<[path: string, priority: number]> = [
  ["/", 1],
  ["/donate", 0.9],
  ["/programmes", 0.9],
  ["/get-support", 0.9],
  ["/report-a-concern", 0.9],
  ["/get-support/request", 0.7],
  ["/about", 0.7],
  ["/resources", 0.7],
  ["/request-a-report", 0.7],
  ["/impact", 0.7],
  ["/projects", 0.7],
  ["/stories", 0.7],
  ["/stories/share", 0.7],
  ["/news", 0.7],
  ["/get-involved", 0.7],
  ["/get-involved/volunteer", 0.7],
  ["/get-involved/partner", 0.7],
  ["/get-involved/sponsor", 0.7],
  ["/contact", 0.7],
  ["/faq", 0.7],
  ["/policies", 0.7],
  ["/privacy/request", 0.5],
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const at = (path: string) => `${base}${path === "/" ? "/" : path}`;
  const [programmes, causes, posts, resources, projects, policies] = await Promise.all([
    getProgrammes(),
    getCauses(),
    getPosts({ pageSize: 48 }).then(async (first) => {
      // getPosts pages at most 48; walk the rest so every published post is listed.
      const pages = Math.ceil(first.total / 48);
      const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, i) => getPosts({ pageSize: 48, page: i + 2 })));
      return [...first.items, ...rest.flatMap((r) => r.items)];
    }),
    getResourceSlugs(),
    getProjects(),
    getPolicies(),
  ]);

  const out: Entry[] = STATIC.map(([path, priority]) => ({
    url: at(path),
    changeFrequency: path === "/news" ? "weekly" : "monthly",
    priority,
  }));
  for (const p of programmes) out.push({ url: at(p.href), changeFrequency: "monthly", priority: 0.9 });
  for (const c of causes) if (!c.closed && c.slug !== "general") out.push({ url: at(`/donate/${c.slug}`), changeFrequency: "weekly", priority: 0.8 });
  for (const p of posts) out.push({ url: at(p.href), lastModified: p.publishedAt ? new Date(p.publishedAt).toISOString() : undefined, changeFrequency: "monthly", priority: 0.6 });
  for (const slug of resources) out.push({ url: at(`/resources/${encodeURIComponent(slug)}`), changeFrequency: "monthly", priority: 0.5 });
  for (const p of projects) out.push({ url: at(`/projects/${encodeURIComponent(p.slug)}`), changeFrequency: "monthly", priority: 0.5 });
  for (const p of policies) out.push({ url: at(p.href), changeFrequency: "monthly", priority: 0.5 });

  // One entry per URL (a programme cause shares its slug with nothing else, but be safe).
  const seen = new Set<string>();
  return out.filter((e) => (seen.has(e.url) ? false : (seen.add(e.url), true)));
}
