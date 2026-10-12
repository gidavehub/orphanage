import "server-only";

// Public per-cause, per-currency totals from `causeTotals/{slug}` (PLAN D36, D38). Cached
// ('use cache' + cacheLife('content') + cacheTag(TAG.donationTotals)); allocation transactions
// increment the documents and their writers invalidate the tag (updateTag in Server Actions,
// revalidateTag(tag, 'max') in the Stripe webhook). Currencies are never summed; the public "raised"
// figure shows only for verified causes (lib/content/read.ts decides).

import { cacheLife, cacheTag } from "next/cache";
import { TAG } from "@/lib/cache/tags";
import type { CauseTotalsByCurrency } from "@/lib/model/dto";
import { CURRENCIES } from "@/lib/model/enums";
import { getStore } from "@/lib/server/db";
import { C, docPath, isValidDocumentId } from "@/lib/server/db/collections";
import { env, resolveBackend } from "@/lib/server/env";
import { log } from "@/lib/server/log";

type Raw = Record<string, unknown>;

function totalsOf(doc: Raw): CauseTotalsByCurrency {
  const out: CauseTotalsByCurrency = {};
  for (const c of CURRENCIES) {
    const v = doc[c];
    if (typeof v !== "object" || v === null) continue;
    const { raisedMinor, gifts } = v as { raisedMinor?: unknown; gifts?: unknown };
    if (typeof raisedMinor !== "number" || !Number.isFinite(raisedMinor)) continue;
    out[c] = { raisedMinor: Math.max(0, Math.round(raisedMinor)), gifts: typeof gifts === "number" && Number.isFinite(gifts) ? Math.max(0, Math.round(gifts)) : 0 };
  }
  return out;
}

/** causeSlug → per-currency totals. An empty object when there is no data. */
export async function getCauseTotals(): Promise<Record<string, CauseTotalsByCurrency>> {
  "use cache";
  cacheLife("content");
  cacheTag(TAG.donationTotals);
  const out: Record<string, CauseTotalsByCurrency> = {};
  try {
    // Causes number in the tens. Ids + getMany rather than an ordered list, so a totals document that
    // an allocation created without `updatedAt` is never skipped by the ordering.
    const store = getStore();
    const ids = (await store.listIds(C.causeTotals)).filter(isValidDocumentId).slice(0, 500);
    const docs = ids.length ? await store.getMany<Raw>(ids.map((id) => docPath("causeTotals", id))) : [];
    for (const doc of docs) {
      if (!doc) continue;
      const t = totalsOf(doc);
      if (Object.keys(t).length) out[doc.id] = t;
    }
  } catch (err) {
    if (resolveBackend() === "firestore" && (env as unknown as { isBuild?: boolean }).isBuild === true) throw err;
    log.error("public.totals_read_failed", { err });
    return {};
  }
  return out;
}
