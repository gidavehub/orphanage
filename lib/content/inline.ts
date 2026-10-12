// InlineText: the tiny inline markup allowed inside content (content-model §7.2). Isomorphic.
//
//   **bold**   _italic_   [label](https://example.org | /internal/path | mailto:x@y | tel:+220…)
//
// Nothing else is markup: there is no raw HTML, no headings and no images inline. Unbalanced markers
// and unsupported link targets are reported by inlineIssues() (the schema rejects them on save) and
// render as plain text if they ever reach a page. Rendering never uses dangerouslySetInnerHTML.

import { createElement, Fragment, type ReactNode } from "react";

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "link"; href: string; external: boolean; children: InlineNode[] };

const LINK_RE = /^\[([^\]\n]{1,200})\]\(([^)\s]{1,500})\)/;

/** Internal paths ("/donate"), https links, mailto: and tel:. Everything else is refused. */
export function isAllowedHref(href: string): boolean {
  if (href.startsWith("/")) return !href.startsWith("//") && !href.includes("\\");
  if (href.startsWith("#")) return /^#[A-Za-z][\w-]*$/.test(href);
  if (/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(href)) return true;
  if (/^tel:\+?[0-9 ()-]{3,24}$/i.test(href)) return true;
  try {
    const u = new URL(href);
    return u.protocol === "https:" && !!u.hostname;
  } catch {
    return false;
  }
}

function isExternal(href: string): boolean {
  return /^https:/i.test(href);
}

/** Parses InlineText into nodes. Never throws; anything it cannot read stays literal text. */
export function parseInline(text: string): InlineNode[] {
  return parseRange(text, 0);
}

function pushText(out: InlineNode[], text: string): void {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === "text") last.text += text;
  else out.push({ type: "text", text });
}

function parseRange(text: string, depth: number): InlineNode[] {
  const out: InlineNode[] = [];
  let i = 0;
  while (i < text.length) {
    const rest = text.slice(i);
    if (depth < 4 && rest.startsWith("**")) {
      const end = text.indexOf("**", i + 2);
      if (end > i + 2) {
        out.push({ type: "strong", children: parseRange(text.slice(i + 2, end), depth + 1) });
        i = end + 2;
        continue;
      }
    }
    if (depth < 4 && rest.startsWith("_") && (i === 0 || /[\s([{"“‘'-]/.test(text[i - 1]))) {
      const end = findItalicEnd(text, i + 1);
      if (end > i + 1) {
        out.push({ type: "em", children: parseRange(text.slice(i + 1, end), depth + 1) });
        i = end + 1;
        continue;
      }
    }
    if (depth < 4 && rest.startsWith("[")) {
      const m = LINK_RE.exec(rest);
      if (m && isAllowedHref(m[2])) {
        out.push({ type: "link", href: m[2], external: isExternal(m[2]), children: parseRange(m[1], depth + 1) });
        i += m[0].length;
        continue;
      }
    }
    pushText(out, text[i]);
    i += 1;
  }
  return out;
}

/** The closing underscore of an italic run: followed by a boundary, not inside a word. */
function findItalicEnd(text: string, from: number): number {
  for (let j = from; j < text.length; j++) {
    if (text[j] === "\n") return -1;
    if (text[j] === "_" && j > from && !/\s/.test(text[j - 1]) && (j + 1 === text.length || /[\s.,;:!?)\]}"”’'-]/.test(text[j + 1]))) {
      return j;
    }
  }
  return -1;
}

/** Plain text of InlineText (excerpts, meta descriptions, search, email bodies). */
export function inlineToPlain(text: string): string {
  return plain(parseInline(text));
}

function plain(nodes: InlineNode[]): string {
  return nodes.map((n) => (n.type === "text" ? n.text : plain(n.children))).join("");
}

/**
 * Problems an editor should fix before saving: unbalanced `**`, a link with a target we refuse, or
 * HTML-looking tags. Empty when the text is fine.
 */
export function inlineIssues(text: string): string[] {
  const issues: string[] = [];
  const stars = text.match(/\*\*/g)?.length ?? 0;
  if (stars % 2 !== 0) issues.push("A bold marker (**) is not closed.");
  const linkRe = /\[([^\]\n]*)\]\(([^)\n]*)\)/g;
  for (let m = linkRe.exec(text); m; m = linkRe.exec(text)) {
    if (!m[1].trim()) issues.push("A link needs some words to click on.");
    else if (!isAllowedHref(m[2].trim())) issues.push(`The link "${m[1].slice(0, 40)}" must start with https://, / (a page on this site), mailto: or tel:.`);
  }
  if (/<\/?[a-z][^>]*>/i.test(text)) issues.push("Please remove HTML tags; use **bold**, _italic_ and [links](https://…) instead.");
  return issues;
}

export type RenderInlineOptions = {
  /** Class for links (defaults to the brand underline style). */
  linkClassName?: string;
  /** Element factory for internal links (next/link's Link). Plain <a> when omitted. */
  internalLink?: (props: { href: string; className?: string; children: ReactNode }) => ReactNode;
};

const DEFAULT_LINK_CLASS = "font-semibold text-forest underline decoration-marigold/70 underline-offset-4 hover:text-marigold";

/** InlineText as React nodes. External links get rel="noopener noreferrer" and a visually hidden note. */
export function renderInline(text: string, opts: RenderInlineOptions = {}): ReactNode {
  return createElement(Fragment, null, ...renderNodes(parseInline(text), opts, "i"));
}

function renderNodes(nodes: InlineNode[], opts: RenderInlineOptions, keyBase: string): ReactNode[] {
  return nodes.map((n, idx) => {
    const key = `${keyBase}.${idx}`;
    switch (n.type) {
      case "text":
        return createElement(Fragment, { key }, n.text);
      case "strong":
        return createElement("strong", { key, className: "font-bold text-ink" }, ...renderNodes(n.children, opts, key));
      case "em":
        return createElement("em", { key }, ...renderNodes(n.children, opts, key));
      case "link": {
        const className = opts.linkClassName ?? DEFAULT_LINK_CLASS;
        const children = renderNodes(n.children, opts, key);
        if (n.external) {
          return createElement(
            "a",
            { key, href: n.href, className, rel: "noopener noreferrer", target: "_blank" },
            ...children,
            createElement("span", { "aria-hidden": true, className: "ml-0.5 inline-block text-[0.85em]" }, "↗"),
            createElement("span", { className: "sr-only" }, " (opens in a new tab)"),
          );
        }
        if (opts.internalLink && n.href.startsWith("/")) {
          return createElement(Fragment, { key }, opts.internalLink({ href: n.href, className, children: createElement(Fragment, null, ...children) }));
        }
        return createElement("a", { key, href: n.href, className }, ...children);
      }
    }
  });
}
