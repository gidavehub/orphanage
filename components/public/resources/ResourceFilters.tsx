"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SearchField } from "@/components/ui/SearchField";
import { Chips } from "@/components/ui/form/Chips";
import { Segmented } from "@/components/ui/form/Segmented";
import { RESOURCE_CATEGORIES, type ResourceAccess, type ResourceCategory } from "@/lib/model/enums";
import { RESOURCE_CATEGORY_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

export type ResourceFiltersProps = {
  q: string;
  category: ResourceCategory | null;
  access: ResourceAccess | null;
  /** Items per category (only categories with items get a pill). */
  counts: Partial<Record<ResourceCategory, number>>;
  total: number;
  className?: string;
};

const ACCESS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "public", label: "Free download" },
  { value: "controlled", label: "On request" },
];

/**
 * The /resources filter bar (public-pages §3.9): a search box, category pills and the access switch,
 * all kept in the URL (`?q=&category=&access=`) so every view can be shared and the server renders
 * it. Typing replaces the URL after a short pause; pills are plain links.
 */
export function ResourceFilters({ q, category, access, counts, total, className }: ResourceFiltersProps) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (next: { q?: string; category?: ResourceCategory | null; access?: ResourceAccess | null }) => {
    const href = routes.resources({
      q: next.q ?? q,
      category: (next.category === undefined ? category : next.category) ?? undefined,
      access: (next.access === undefined ? access : next.access) ?? undefined,
    });
    start(() => router.replace(href, { scroll: false }));
  };

  const options = [
    { value: "all", label: "All topics", count: total, href: routes.resources({ q, access: access ?? undefined }) },
    ...RESOURCE_CATEGORIES.filter((c) => (counts[c] ?? 0) > 0 || c === category).map((c) => ({
      value: c,
      label: RESOURCE_CATEGORY_LABEL[c],
      count: counts[c] ?? 0,
      href: routes.resources({ q, category: c, access: access ?? undefined }),
    })),
  ];

  return (
    <div className={cn("grid gap-5 rounded-card-lg bg-white p-4 shadow-card transition-opacity sm:p-5", pending && "opacity-80", className)} aria-busy={pending}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <SearchField label="Search resources" placeholder="Search guides, policies and reports" defaultValue={q} onSearch={(v) => go({ q: v })} debounce={400} />
        <Segmented
          name="access"
          label="Access"
          options={ACCESS_OPTIONS}
          value={access ?? "all"}
          onChange={(v) => go({ access: v === "all" ? null : (v as ResourceAccess) })}
        />
      </div>
      {options.length > 2 ? <Chips options={options} value={category ?? "all"} label="Filter by topic" tone="clay" size="sm" scroll /> : null}
    </div>
  );
}
