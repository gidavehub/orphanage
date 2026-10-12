import "server-only";

// Selftest suite "ai" (PLAN §6.3 I4), offline: with no provider the monthly job writes ONE template
// draft for review (with ✎ boxes) and a second run in the same month writes none; the validator flags
// numbers and words the facts don't support; "Help me write" says it's off; cover prompts name the
// nationality and never ask for children; the fact sheet reads public sources only.

import { systemActor } from "@/lib/model/viewer";
import { contentStore, removeItem } from "@/lib/content/store";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import { assist } from "@/lib/server/ai/assist";
import { buildCoverPrompt } from "@/lib/server/ai/cover";
import { buildFactSheet, periodOf, type FactSheet } from "@/lib/server/ai/facts";
import { previousMonth, runMonthlyDraft } from "@/lib/server/ai/monthly";
import { textModels } from "@/lib/server/ai/provider";
import type { AiPostDraft } from "@/lib/server/ai/schemas";
import { validateDraft } from "@/lib/server/ai/validate";
import { caseRecorder } from "../selftest";
import type { Suite } from "../types";

const MONTH = "2099-01";

function sheet(): FactSheet {
  return {
    period: periodOf("2098-12"),
    facts: [
      { id: "F1", kind: "update", text: "Back to school: 50 children returned to class with fees and books.", numbers: ["50"], source: "post:back-to-school" },
      { id: "F2", kind: "stat", text: "Families supported: 1214", numbers: ["1214"], source: "stat:families" },
    ],
    allowedNames: ["Haven", "Education"],
    allowedPlaces: ["The Gambia", "Senegal"],
    voice: "",
    mustAvoid: [],
    programmes: [],
    verifiedStatIds: ["families"],
    liveCauses: ["education"],
    substance: 1,
  };
}

function draft(text: string): AiPostDraft {
  return {
    title: "December at Haven",
    excerpt: "A look back at December and what changed for families.",
    category: "impact-update",
    programmeIds: ["education"],
    countries: ["gm"],
    body: [
      { type: "paragraph", text },
      { type: "stat", statId: "families" },
      { type: "cta", kind: "donate" },
    ],
    citations: [{ block: 0, facts: ["F1"] }],
    notesForReviewer: "",
    cover: { subject: "adults", scene: "A community meeting under a tree.", country: "gm" },
  };
}

export const suite: Suite = {
  name: "ai",
  async run() {
    const t = caseRecorder();
    const store = getStore();

    await t.check("the validator accepts numbers from the facts", () => {
      const flags = validateDraft(draft("This month 50 children went back to school in The Gambia."), sheet());
      const numberFlags = flags.filter((f) => f.rule === "number");
      if (numberFlags.length) throw new Error(numberFlags.map((f) => f.text).join(" | "));
      return true;
    });

    await t.check("an injected number is a hard flag", () => {
      const flags = validateDraft(draft("This month 500 children went back to school."), sheet());
      return flags.some((f) => f.rule === "number" && f.severity === "hard");
    });

    await t.check("spelled-out numbers, diagnoses and contact details are hard flags", () => {
      const flags = validateDraft(draft("Twenty families with trauma wrote to hello@example.org."), sheet());
      const rules = new Set(flags.filter((f) => f.severity === "hard").map((f) => f.rule));
      return rules.has("spelled_number") && rules.has("diagnosis") && rules.has("contact") ? true : `rules=${[...rules].join(",")}`;
    });

    await t.check("a name near child words is a hard flag", () => {
      const flags = validateDraft(draft("Fatou, a girl from Brikama, went back to school."), sheet());
      return flags.some((f) => f.severity === "hard" && (f.rule === "name" || f.rule === "place"));
    });

    await t.check("cover prompts name the people and never ask for children", () => {
      const gm = buildCoverPrompt({ subject: "adults", scene: "A community meeting under a tree.", country: "gm" });
      const anywhere = buildCoverPrompt({ subject: "adults", scene: "Neighbours sharing a meal.", country: null }, 1);
      const ok = /Gambian/.test(gm) && /No children/.test(gm) && /(Indian|Filipino|Jordanian|Gambian)/.test(anywhere) && !/\bwhite\b/i.test(gm + anywhere) && !/\bchild(ren)?\b(?! *\.)/i.test(gm.replace("No children", ""));
      return ok ? true : `gm=${gm.slice(-200)}`;
    });

    await t.check("the fact sheet uses public sources only", async () => {
      const s = await buildFactSheet(previousMonth(new Date().toISOString().slice(0, 7)));
      const bad = s.facts.filter((f) => !/^(post|stat|cause|topic|programme):|^org$/.test(f.source));
      if (bad.length) throw new Error(`unexpected sources: ${bad.map((f) => f.source).join(",")}`);
      return true;
    });

    if (textModels().length > 0) {
      await t.check("with a provider set up, the offline checks below are skipped", () => "skipped: a provider is configured");
      return t.cases;
    }

    await t.check("with the helper off, “Help me write” says so and changes nothing", async () => {
      const r = await assist({ kind: "tighten", text: "We welcomed 50 children back to class this month." });
      return r.kind === "off";
    });

    let postId: string | null = null;
    try {
      await t.check("with AI off, the monthly job writes one draft for review, with ✎ boxes", async () => {
        const r = await runMonthlyDraft({ force: true, month: MONTH, trigger: "selftest" });
        postId = r.created;
        if (!postId) throw new Error(`nothing created (${r.reason})`);
        const rec = (await contentStore().getItem("posts", postId)) as { draft?: { status: string; origin?: { kind: string }; body: Array<{ type: string; text?: string }> } } | null;
        const d = rec?.draft;
        const todo = d?.body.some((b) => b.type === "callout" && (b.text ?? "").startsWith("✎"));
        return d?.status === "in_review" && d.origin?.kind === "ai" && todo && r.provider === "template" ? true : `status=${d?.status} todo=${todo}`;
      });

      await t.check("a second run in the same month writes nothing", async () => {
        const again = await runMonthlyDraft({ month: MONTH, trigger: "selftest" });
        return again.created === null && again.reason === "already_done" ? true : `created=${again.created} reason=${again.reason}`;
      });
    } finally {
      if (postId) {
        const rec = await contentStore().getItem("posts", postId);
        if (rec) await removeItem(systemActor("selftest"), { collection: "posts", id: postId, baseVersion: rec.version }).catch(() => undefined);
      }
      const jobs = await store.list(C.aiJobs, { orderBy: { field: "startedAt", dir: "desc" }, limit: 50 }).catch(() => ({ items: [] as Array<{ id: string }> }));
      for (const j of jobs.items) if (j.id.startsWith(`monthly-${MONTH}`)) await store.delete(`${C.aiJobs}/${j.id}`).catch(() => undefined);
    }
    return t.cases;
  },
};
