"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { SkeletonRow } from "./Skeleton";
import { cn } from "@/lib/cn";

export type DataColumn<T> = {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  /** 1: always (the row title on phones), 2: phones' meta line and up, 3: tables only (md and up). */
  priority: 1 | 2 | 3;
  align?: "start" | "end";
  /** Client-side sort on this column; needs `sortValue` (or the cell must be text). */
  sortable?: boolean;
  sortValue?: (row: T) => string | number | null | undefined;
  /** CSS width of the column on tables, e.g. "160px" or "20%". */
  width?: string;
};

export type DataListProps<T> = {
  rows: T[];
  columns: DataColumn<T>[];
  rowKey: (row: T) => string;
  /** Opens the row (a sheet or a pushed route). The row title is then a button for keyboard users. */
  onRowClick?: (row: T) => void;
  /** A link per row instead of onRowClick (works without JS on phones too). */
  rowHref?: (row: T) => string;
  /** A trailing element on phones (usually the StatusPill), beside the title. */
  mobileAside?: (row: T) => React.ReactNode;
  selectable?: boolean;
  selected?: string[];
  onSelect?: (ids: string[]) => void;
  /** Sticky action bar shown while rows are selected. */
  bulkActions?: (ids: string[]) => React.ReactNode;
  /** Rendered when there are no rows (usually an EmptyState). */
  empty: React.ReactNode;
  loading?: boolean;
  /** Table caption (visually hidden); names the list for screen readers. */
  caption: string;
  className?: string;
};

type Sort = { key: string; dir: "asc" | "desc" } | null;

/**
 * The DataTable-lite (design-system §3.6). From md: a real `<table>` in a white card with sortable
 * headers (aria-sort). Below md: each row becomes a stacked card row (no horizontal scroll) with the
 * priority-1 cell as its title and priority-2 cells as a meta line. Must be rendered from a client
 * component, because columns carry render functions.
 */
export function DataList<T>({
  rows,
  columns,
  rowKey,
  onRowClick,
  rowHref,
  mobileAside,
  selectable,
  selected = [],
  onSelect,
  bulkActions,
  empty,
  loading,
  caption,
  className,
}: DataListProps<T>) {
  const [sort, setSort] = useState<Sort>(null);
  const router = useRouter();

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => {
      const x = get(a);
      const y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "en", { numeric: true });
    });
    return sort.dir === "desc" ? out.reverse() : out;
  }, [rows, columns, sort]);

  const ids = sorted.map(rowKey);
  const allOn = selectable && ids.length > 0 && ids.every((id) => selected.includes(id));
  const toggle = (id: string) => onSelect?.(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  const titleCol = columns.find((c) => c.priority === 1) ?? columns[0];
  const metaCols = columns.filter((c) => c.priority === 2);

  if (loading) {
    return (
      <div role="status" aria-label={`${caption}: loading`} className={cn("overflow-hidden rounded-card bg-white shadow-soft", className)}>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <div className={className}>{empty}</div>;

  const open = (row: T) => onRowClick?.(row);

  return (
    <div className={cn("relative", className)}>
      {/* ≥ md: table */}
      <div className="hidden overflow-hidden rounded-card bg-white shadow-soft md:block">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-cream-2">
              {selectable ? (
                <th scope="col" className="w-12 pl-4">
                  <input
                    type="checkbox"
                    aria-label="Select all rows"
                    checked={!!allOn}
                    onChange={() => onSelect?.(allOn ? [] : ids)}
                    className="size-5 accent-forest"
                  />
                </th>
              ) : null}
              {columns.map((c) => {
                const dir = sort?.key === c.key ? sort.dir : null;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                    className={cn(
                      "h-11 px-4 font-grotesk text-[12px] font-semibold uppercase tracking-[0.06em] text-body",
                      c.align === "end" && "text-right",
                    )}
                  >
                    {c.sortable && c.sortValue ? (
                      <button
                        type="button"
                        onClick={() => setSort(dir === "asc" ? { key: c.key, dir: "desc" } : dir === "desc" ? null : { key: c.key, dir: "asc" })}
                        className={cn("inline-flex items-center gap-1 uppercase tracking-[0.06em] hover:text-ink", c.align === "end" && "flex-row-reverse")}
                      >
                        {c.header}
                        {dir === "asc" ? (
                          <ArrowUp aria-hidden className="size-3.5" />
                        ) : dir === "desc" ? (
                          <ArrowDown aria-hidden className="size-3.5" />
                        ) : (
                          <ChevronsUpDown aria-hidden className="size-3.5 opacity-60" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const id = rowKey(row);
              const on = selected.includes(id);
              const href = rowHref?.(row);
              return (
                <tr
                  key={id}
                  onClick={onRowClick ? () => open(row) : href ? () => router.push(href) : undefined}
                  className={cn(
                    "h-14 border-t border-line text-[15px] text-ink transition-colors",
                    (onRowClick || href) && "cursor-pointer hover:bg-cream",
                    on && "bg-mint/40",
                  )}
                >
                  {selectable ? (
                    <td className="pl-4" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select row ${id}`}
                        checked={on}
                        onChange={() => toggle(id)}
                        className="size-5 accent-forest"
                      />
                    </td>
                  ) : null}
                  {columns.map((c) => (
                    <td key={c.key} className={cn("px-4 py-2", c.align === "end" && "text-right tabular-nums", c !== titleCol && "text-[14px]")}>
                      {c === titleCol && href ? (
                        <Link href={href} onClick={(e) => e.stopPropagation()} className="font-bold hover:text-forest hover:underline">
                          {c.cell(row)}
                        </Link>
                      ) : c === titleCol && onRowClick ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(row);
                          }}
                          className="text-left font-bold hover:text-forest"
                        >
                          {c.cell(row)}
                        </button>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* < md: stacked rows */}
      <ul aria-label={caption} className="overflow-hidden rounded-card bg-white shadow-soft md:hidden">
        {sorted.map((row) => {
          const id = rowKey(row);
          const on = selected.includes(id);
          const href = rowHref?.(row);
          const title = titleCol.cell(row);
          return (
            <li key={id} className={cn("flex items-start gap-3 border-t border-line px-4 py-3 first:border-t-0", on && "bg-mint/40")}>
              {selectable ? (
                <input type="checkbox" aria-label={`Select row ${id}`} checked={on} onChange={() => toggle(id)} className="mt-1 size-5 shrink-0 accent-forest" />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  {href ? (
                    <Link href={href} className="min-w-0 text-[16px] font-bold leading-snug text-ink">
                      {title}
                    </Link>
                  ) : onRowClick ? (
                    <button type="button" onClick={() => open(row)} className="min-w-0 text-left text-[16px] font-bold leading-snug text-ink">
                      {title}
                    </button>
                  ) : (
                    <div className="min-w-0 text-[16px] font-bold leading-snug text-ink">{title}</div>
                  )}
                  {mobileAside ? <div className="shrink-0">{mobileAside(row)}</div> : null}
                </div>
                {metaCols.length ? (
                  <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-grotesk text-[13px] text-body">
                    {metaCols.map((c) => (
                      <span key={c.key}>{c.cell(row)}</span>
                    ))}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {selectable && selected.length > 0 && bulkActions ? (
        <div className="sticky bottom-[max(1rem,env(safe-area-inset-bottom))] z-20 mt-4 flex flex-wrap items-center gap-3 rounded-full bg-night px-5 py-2.5 text-white shadow-float focus-marigold">
          <span className="font-grotesk text-[14px] font-semibold tabular-nums">{selected.length} selected</span>
          <div className="ml-auto flex flex-wrap gap-2">{bulkActions(selected)}</div>
        </div>
      ) : null}
    </div>
  );
}
