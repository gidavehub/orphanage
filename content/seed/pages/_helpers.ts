// Small builders for page seeds (content/seed/pages/<key>.ts). Copy lives in the page files.

import "server-only";

import type { Block, DocSeed } from "@/lib/content/types";

export type PageSeed = DocSeed<"pages.about">;

/** A paragraph block. */
export const para = (id: string, text: string): Block => ({ id, type: "paragraph", text });

/** A bullet list block. */
export const bullets = (id: string, items: string[]): Block => ({ id, type: "list", style: "bullet", items });

/** Section items from [title, text?, icon?] tuples. */
export const items = (rows: Array<[title: string, text?: string, icon?: string]>) =>
  rows.map(([title, text, icon]) => ({ title, ...(text ? { text } : {}), ...(icon ? { icon } : {}) }));
