import "server-only";

// Selftest suite "store" (F2): the DocStore contract both adapters must pass (data-model §8.2–8.4).
// Everything happens under a scratch root (selftestRuns/<id>/…), deleted at the end. Collections
// under the root reuse real collection ids, so firestore.indexes.json applies exactly as in production.

import { getStore } from "@/lib/server/db";
import { ConflictError, F, MissingIndexError, NotFoundError } from "@/lib/server/db/store";
import { BLOB_PATH, getBlobStore, verifyDevFileToken } from "@/lib/server/storage";
import { caseRecorder, dropScratch, scratchRoot } from "../selftest";
import type { Suite } from "../types";

type Row = {
  status: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  version: number;
  category?: string;
  lastActivityAt?: number;
  searchTokens?: string[];
  nested?: { reviewedAt: number; note: string };
  list?: Array<{ doneAt: number }>;
  count?: number;
  tags?: string[];
  gone?: string;
};

function row(i: number, status = "new", extra: Partial<Row> = {}): Row {
  return { status, archived: false, createdAt: 1_700_000_000_000 + i * 1000, updatedAt: 1_700_000_000_000 + i * 1000, version: 1, ...extra };
}

export const suite: Suite = {
  name: "store",
  async run() {
    const t = caseRecorder();
    const store = getStore();
    const root = scratchRoot();
    const col = `${root}/supportRequests`;
    const other = `${root}/counters`;
    try {
      await t.check(`adapter is ${store.kind}`, () => `kind=${store.kind}`);

      await t.check("create, then read back with its id", async () => {
        await store.create(`${col}/A1`, row(1));
        const d = await store.get<Row>(`${col}/A1`);
        return d?.id === "A1" && d.status === "new" && d.createdAt === row(1).createdAt;
      });
      await t.throws("create on an existing document → ConflictError", ConflictError, () => store.create(`${col}/A1`, row(1)));
      await t.throws("update of a missing document → NotFoundError", NotFoundError, () => store.update(`${col}/missing`, { status: "x" }));
      await t.throws("update with a stale expectedVersion → ConflictError", ConflictError, () => store.update(`${col}/A1`, { status: "under_review" }, { expectedVersion: 99 }));
      await t.check("update with the current expectedVersion", async () => {
        await store.update(`${col}/A1`, { status: "under_review", version: 2 }, { expectedVersion: 1 });
        return (await store.get<Row>(`${col}/A1`))?.version === 2;
      });
      await t.throws("invalid path segment ('..') is refused", Error, () => store.get(`${col}/..`));

      await t.check("a failing transaction writes nothing", async () => {
        try {
          await store.runTransaction(async (tx) => {
            tx.create(`${col}/T1`, row(2));
            tx.set(`${other}/T2`, { next: 1 });
            throw new Error("boom");
          });
        } catch {
          // expected
        }
        const [a, b] = await store.getMany([`${col}/T1`, `${other}/T2`]);
        return a === null && b === null;
      });
      await t.check("a transaction whose create conflicts writes nothing", async () => {
        let conflicted = false;
        try {
          await store.runTransaction(async (tx) => {
            tx.set(`${other}/T3`, { next: 1 });
            tx.create(`${col}/A1`, row(1));
          });
        } catch (err) {
          conflicted = err instanceof ConflictError;
        }
        return conflicted && (await store.get(`${other}/T3`)) === null;
      });
      await t.check("20 concurrent read-modify-write transactions are serialised", async () => {
        const p = `${other}/C1`;
        await Promise.all(
          Array.from({ length: 20 }, () =>
            store.runTransaction(async (tx) => {
              const c = await tx.get<{ next: number }>(p);
              tx.set(p, { next: (c?.next ?? 0) + 1 });
            }),
          ),
        );
        const n = (await store.get<{ next: number }>(p))?.next;
        if (n !== 20) throw new Error(`next=${n}`);
        return true;
      });
      await t.check("tx.get sees committed state, not this transaction's own writes", async () => {
        const seen = await store.runTransaction(async (tx) => {
          tx.set(`${other}/C2`, { next: 5 });
          return tx.get(`${other}/C2`);
        });
        return seen === null && (await store.get<{ next: number }>(`${other}/C2`))?.next === 5;
      });

      await t.check("*At values round-trip as epoch ms (nested and in arrays)", async () => {
        const at = 1_760_000_000_123;
        await store.create(`${col}/AT`, row(3, "new", { nested: { reviewedAt: at, note: "x" }, list: [{ doneAt: at + 1 }] }));
        const d = await store.get<Row>(`${col}/AT`);
        return d?.createdAt === row(3).createdAt && d.nested?.reviewedAt === at && d.list?.[0]?.doneAt === at + 1 && typeof d.updatedAt === "number";
      });

      await t.check("FieldOps and dotted paths (increment, arrayUnion, arrayRemove, delete)", async () => {
        await store.create(`${col}/OPS`, row(4, "new", { count: 1, tags: ["a"], gone: "x", nested: { reviewedAt: 1, note: "old" } }));
        await store.update(`${col}/OPS`, { count: F.increment(2), tags: F.arrayUnion("b", "a"), gone: F.delete(), "nested.note": "new" });
        await store.update(`${col}/OPS`, { tags: F.arrayRemove("a") });
        const d = await store.get<Row>(`${col}/OPS`);
        return d?.count === 3 && JSON.stringify(d.tags) === '["b"]' && d.gone === undefined && d.nested?.note === "new" && d.nested.reviewedAt === 1;
      });

      // Paging and filters over the (archived, status, createdAt desc) composite index.
      await store.batch((b) => {
        for (let i = 10; i < 17; i++) b.create(`${col}/P${i}`, row(i, i % 2 ? "new" : "under_review", { searchTokens: i < 13 ? ["fatou", `p${i}`] : [`p${i}`] }));
        b.create(`${col}/P99`, row(99, "closed"));
      });
      await t.check("cursor paging (3 per page): newest first, no repeats", async () => {
        const where = [
          { field: "archived", op: "==" as const, value: false },
          { field: "status", op: "in" as const, value: ["new", "under_review"] },
        ];
        const ids: string[] = [];
        let cursor: string | null = null;
        const sizes: number[] = [];
        for (let i = 0; i < 5; i++) {
          const page: { items: Array<{ id: string }>; nextCursor: string | null } = await store.list(col, { where, orderBy: { field: "createdAt", dir: "desc" }, limit: 3, cursor });
          sizes.push(page.items.length);
          ids.push(...page.items.map((x) => x.id));
          cursor = page.nextCursor;
          if (!cursor) break;
        }
        const expected = ["P16", "P15", "P14", "P13", "P12", "P11", "P10"];
        // A1, AT and OPS also match (new / under_review); they are older, so they come last.
        const head = ids.slice(0, 7);
        if (JSON.stringify(head) !== JSON.stringify(expected) || new Set(ids).size !== ids.length || sizes[0] !== 3) throw new Error(`ids=${ids.join(",")}`);
        return true;
      });
      await t.check("'in' filter excludes other statuses", async () => {
        const page = await store.list<Row>(col, {
          where: [
            { field: "archived", op: "==", value: false },
            { field: "status", op: "in", value: ["closed"] },
          ],
          orderBy: { field: "createdAt", dir: "desc" },
          limit: 10,
        });
        return page.items.length === 1 && page.items[0].id === "P99";
      });
      await t.check("'array-contains' finds tokens", async () => {
        const page = await store.list<Row>(col, { where: [{ field: "searchTokens", op: "array-contains", value: "fatou" }], orderBy: { field: "createdAt", dir: "desc" }, limit: 10 });
        return page.items.map((x) => x.id).join(",") === "P12,P11,P10";
      });
      await t.check("count() with filters", async () => {
        const n = await store.count(col, [{ field: "status", op: "==", value: "new" }]);
        const all = await store.count(col);
        // new: AT, OPS, P11, P13, P15. All: A1, AT, OPS, P10–P16, P99.
        if (n === 5 && all === 11) return true;
        throw new Error(`new=${n} all=${all}`);
      });
      await t.throws(
        "a query without a composite index → MissingIndexError",
        MissingIndexError,
        () => store.list(col, { where: [{ field: "category", op: "==", value: "education" }], orderBy: { field: "lastActivityAt", dir: "desc" }, limit: 5 }),
      );

      await t.check("getMany and listIds", async () => {
        const docs = await store.getMany<Row>([`${col}/P10`, `${col}/nope`]);
        const ids = await store.listIds(col);
        return docs[0]?.id === "P10" && docs[1] === null && ids.includes("P16") && ids.length === 11;
      });

      await t.check("recursive delete removes subcollections; plain delete keeps them", async () => {
        await store.create(`${col}/R1`, row(50));
        await store.create(`${col}/R1/notes/n1`, { body: "x", createdAt: 1 });
        await store.create(`${col}/R2`, row(51));
        await store.create(`${col}/R2/notes/n1`, { body: "y", createdAt: 1 });
        await store.delete(`${col}/R1`, { recursive: true });
        await store.delete(`${col}/R2`);
        const [r1, r1n, r2, r2n] = await store.getMany([`${col}/R1`, `${col}/R1/notes/n1`, `${col}/R2`, `${col}/R2/notes/n1`]);
        return r1 === null && r1n === null && r2 === null && r2n !== null;
      });
      // BlobStore (local driver in practice mode; GCS in Firestore mode).
      const blobs = getBlobStore();
      const blobId = root.split("/")[1];
      if (blobs.kind !== "none") {
        const a = BLOB_PATH.quarantine(`${blobId}-a`);
        const b = BLOB_PATH.caseAttachment("selftest", blobId, "att1", "pdf");
        await t.check(`blob store (${blobs.kind}): put → get → move → stream → delete`, async () => {
          const body = Buffer.from("%PDF-1.4\n% selftest\n");
          await blobs.put(a, body, "application/pdf");
          const got = await blobs.get(a);
          await blobs.move(a, b);
          const gone = await blobs.get(a);
          const streamed = await blobs.stream(b);
          await blobs.delete(b);
          const after = await blobs.get(b);
          return got?.body.equals(body) === true && got.contentType === "application/pdf" && gone === null && streamed?.size === body.length && after === null;
        });
        await t.check("signed URLs are short-lived and bound to one path", async () => {
          await blobs.put(b, Buffer.from("x"), "application/pdf");
          const url = await blobs.signedUrl(b, { ttlSec: 60, disposition: "attachment" });
          const removed = await blobs.deletePrefix(`private/cases/selftest/${blobId}`);
          if (blobs.kind === "local") {
            const token = new URL(url, "http://localhost").searchParams.get("t");
            return url.startsWith("/api/dev/files/private/cases/") && verifyDevFileToken(b, token)?.disposition === "attachment" && verifyDevFileToken(a, token) === null && removed === 1;
          }
          return url.startsWith("https://") && removed === 1;
        });
        await t.throws("storage paths cannot escape their root", Error, () => blobs.get("private/../keys/data.key"));
      }
    } finally {
      await dropScratch(root);
    }
    await t.check("scratch data removed", async () => (await getStore().listIds(`${root}/supportRequests`)).length === 0);
    return t.cases;
  },
};
