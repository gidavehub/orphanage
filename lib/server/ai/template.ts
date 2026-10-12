import "server-only";

// The template writer (integrations §5.4): no AI, always available. Builds the month's draft from the
// same fact sheet: one heading per programme with that month's published update text verbatim
// (already consent-checked when it was published), verified figures as stat blocks, a "✎ Write a few
// lines about…" callout per planned topic (SafetyCheck blocks Put live until they are replaced), and
// a closing donate block.

import type { PostDraftInput } from "@/lib/content/schema";
import type { FactSheet } from "./facts";

export const TEMPLATE_TODO = "✎ Write a few lines about:";

export function templateDraft(sheet: FactSheet, monthLabel: string): PostDraftInput {
  const body: PostDraftInput["body"] = [];
  let i = 0;
  const id = () => `t${(i++).toString(36)}`;
  const updates = sheet.facts.filter((f) => f.kind === "update");
  const topics = sheet.facts.filter((f) => f.kind === "topic");
  const stats = sheet.verifiedStatIds.slice(0, 3);

  body.push({ id: id(), type: "paragraph", text: `A look back at ${monthLabel}: updates from our programmes and the figures our team has verified.` });
  if (updates.length) {
    body.push({ id: id(), type: "heading", level: 2, text: "From our programmes" });
    for (const u of updates.slice(0, 8)) body.push({ id: id(), type: "paragraph", text: u.text.slice(0, 1200) });
  }
  for (const s of stats) body.push({ id: id(), type: "stat", statId: s });
  for (const t of topics.slice(0, 6)) {
    const topic = t.text.replace(/^Topic to cover:\s*/, "").slice(0, 120);
    body.push({ id: id(), type: "heading", level: 2, text: topic.slice(0, 80) });
    body.push({ id: id(), type: "callout", tone: "warm", text: `${TEMPLATE_TODO} ${topic}` });
  }
  if (!updates.length && !topics.length) body.push({ id: id(), type: "callout", tone: "warm", text: `${TEMPLATE_TODO} what happened at Haven this month` });
  body.push({ id: id(), type: "cta", kind: "donate" });

  return {
    format: "article",
    title: `${monthLabel.split(" ")[0]} at Haven`,
    excerpt: `A look back at ${monthLabel}: updates from our programmes and the figures our team has verified.`.slice(0, 220),
    category: "impact-update",
    programmeIds: [],
    causeSlugs: [],
    countries: [],
    tags: [],
    body,
  } as PostDraftInput;
}
