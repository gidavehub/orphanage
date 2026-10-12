import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/*
 * Import boundaries (PLAN §4.2 and D17–D19, D27). One local rule checks every import against all the
 * boundaries that apply to a file. (Several `no-restricted-imports` blocks would not combine: ESLint
 * keeps only the last block's options for a file.)
 *
 * Specifiers are resolved to repo-relative paths first: "@/lib/server/env" and "../server/env" (from
 * lib/model) both become "lib/server/env". Bare packages stay as written ("firebase/auth").
 */

// The legacy content/{home,people,programmes,site,nav}.ts modules were deleted at the P gate; nothing
// may bring them back.
const LEGACY_CONTENT_ALLOWLIST = [];

/** @type {Array<{ name: string; files: RegExp[]; except?: RegExp[]; allowTypeImports?: boolean; forbid: Array<{ target?: RegExp; raw?: RegExp; message: string }> }>} */
const BOUNDARIES = [
  {
    name: "client-safe",
    files: [
      /^components\//,
      /^lib\/model\//,
      /^lib\/forms\//,
      /^lib\/schemas\//,
      /^lib\/routes\.ts$/,
      /^lib\/nav\.ts$/,
      /^lib\/money\.ts$/,
      /^lib\/countries\.ts$/,
      /^lib\/admin\/(access|copy|format)\.ts$/,
      /^lib\/client\//,
    ],
    allowTypeImports: true,
    forbid: [
      { target: /^lib\/server(\/|$)/, message: "Client-safe code must not import lib/server/** (type-only imports are fine)." },
      {
        target: /^lib\/content\/(read|store|actions|defaults|public)(\.tsx?)?$/,
        message: "Client-safe code must not import the server content modules (read, store, actions, defaults, public).",
      },
      { target: /^content\/seed(\/|$)/, message: "Client-safe code must not import content/seed/**." },
    ],
  },
  {
    name: "ui-plain-props",
    files: [/^components\/ui\//],
    forbid: [
      { target: /^lib\/content(\/|$)/, message: "components/ui/** takes plain props (lib/model/ui.ts); never import lib/content/** (D27)." },
      { target: /^lib\/server(\/|$)/, message: "components/ui/** never imports lib/server/** (D27)." },
    ],
  },
  {
    name: "app-through-dal",
    files: [/^app\//],
    except: [/^app\/api\/dev\//, /^app\/m\//, /^app\/api\/admin\/attachments\//],
    forbid: [
      {
        target: /^lib\/server\/(db|storage)(\/|$)/,
        message: "app/** reaches data through lib/server/{dal,intake,public} or lib/content, never lib/server/db or storage.",
      },
    ],
  },
  {
    name: "seeds",
    files: [/./],
    except: [/^lib\/content\/defaults\.ts$/, /^lib\/server\/public\/resources\.ts$/, /^content\/seed\//],
    forbid: [{ target: /^content\/seed(\/|$)/, message: "Only lib/content/defaults.ts and lib/server/public/resources.ts import content/seed/**." }],
  },
  {
    name: "firebase-client",
    files: [/./],
    except: [/^lib\/client\/(firebase|mfa)\.ts$/],
    allowTypeImports: true,
    forbid: [{ target: /^firebase(\/|$)/, message: "Only lib/client/firebase.ts and lib/client/mfa.ts import firebase/* (D111)." }],
  },
  {
    name: "firebase-admin",
    files: [/./],
    // Plus the go-live command-line scripts (PLAN §6.3 I8), which run outside the app.
    except: [/^lib\/server\/db\/firestore\.ts$/, /^lib\/server\/storage\/gcs\.ts$/, /^lib\/server\/auth\/firebase\.ts$/, /^scripts\/data\//],
    allowTypeImports: true,
    forbid: [
      {
        target: /^firebase-admin(\/|$)/,
        message: "Only lib/server/db/firestore.ts, lib/server/storage/gcs.ts and lib/server/auth/firebase.ts import firebase-admin.",
      },
    ],
  },
  {
    name: "legacy-content",
    files: [/./],
    except: LEGACY_CONTENT_ALLOWLIST,
    forbid: [
      {
        target: /^content\/(home|people|programmes|site|nav)(\.tsx?)?$/,
        message: "Legacy content/{home,people,programmes,site,nav} is being retired: read content through lib/content.",
      },
    ],
  },
  {
    name: "relative-only",
    files: [/^content\/(world|media-map|media-credits|people-mix)\.ts$/, /^lib\/media\/pipeline\.ts$/],
    forbid: [
      { raw: /^@\//, message: "This module is loaded by Node scripts: use relative imports only." },
      { raw: /^server-only$/, message: "This module is loaded by Node scripts: it must not import server-only." },
    ],
  },
  {
    name: "model-purity",
    files: [/^lib\/model\//],
    forbid: [
      { target: /^content(\/|$)/, message: "lib/model/** imports nothing from content/* (D19)." },
      { target: /^lib\/content(\/|$)/, message: "lib/model/** never imports lib/content/**." },
    ],
  },
  {
    name: "session-constants",
    files: [/^lib\/model\/session\.ts$/],
    forbid: [{ raw: /.*/, message: "lib/model/session.ts imports nothing: proxy.ts depends on it (D18)." }],
  },
  {
    // The AI writer sees public-safe facts only (integrations §5.5): never case, donor, staff or
    // email data, and never the database directly.
    name: "ai-public-facts",
    files: [/^lib\/server\/ai\/(facts|template|validate|prompts\/)/],
    forbid: [
      { target: /^lib\/server\/(db|storage)(\/|$)/, message: "The AI fact sheet reads public content only, never lib/server/db or storage." },
      {
        target: /^lib\/server\/dal\/(support|concerns|appointments|donations|recurring|volunteers|partnerships|engagement|inbox|staff|activity|settings|reportRequests)(\.tsx?)?$/,
        message: "The AI fact sheet must never read case, donor, staff or email data (integrations §5.5).",
      },
      { target: /^lib\/server\/(giving|intake|payments|email)(\/|$)/, message: "The AI fact sheet must never read gifts, intake or email data." },
    ],
  },
  {
    name: "proxy",
    files: [/^proxy\.ts$/],
    forbid: [{ raw: /^(?!next\/server$|@\/lib\/model\/session$).*/, message: "proxy.ts imports only next/server and @/lib/model/session (D89)." }],
  },
];

function resolveSpecifier(raw, file) {
  if (raw.startsWith("@/")) return raw.slice(2);
  if (raw.startsWith("./") || raw.startsWith("../")) return path.posix.normalize(path.posix.join(path.posix.dirname(file), raw));
  return raw;
}

function isTypeOnly(node) {
  if (node.importKind === "type" || node.exportKind === "type") return true;
  const specs = node.specifiers ?? [];
  return specs.length > 0 && specs.every((s) => s.importKind === "type" || s.exportKind === "type");
}

const boundariesRule = {
  meta: {
    type: "problem",
    docs: { description: "Enforce Haven's import boundaries (PLAN §4.2)." },
    schema: [],
    messages: { boundary: "{{message}} [{{name}}: {{specifier}}]" },
  },
  create(context) {
    const rel = path.relative(ROOT, context.filename).split(path.sep).join("/");
    if (!rel || rel.startsWith("..")) return {};
    const applicable = BOUNDARIES.filter((b) => b.files.some((r) => r.test(rel)) && !(b.except ?? []).some((r) => r.test(rel)));
    if (applicable.length === 0) return {};

    function check(node, sourceNode, typeOnly) {
      if (!sourceNode || typeof sourceNode.value !== "string") return;
      const raw = sourceNode.value;
      const target = resolveSpecifier(raw, rel);
      for (const b of applicable) {
        if (typeOnly && b.allowTypeImports) continue;
        for (const f of b.forbid) {
          const hit = (f.raw && f.raw.test(raw)) || (f.target && f.target.test(target));
          if (hit) context.report({ node: sourceNode, messageId: "boundary", data: { message: f.message, name: b.name, specifier: raw } });
        }
      }
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source, isTypeOnly(node));
      },
      ExportNamedDeclaration(node) {
        if (node.source) check(node, node.source, isTypeOnly(node));
      },
      ExportAllDeclaration(node) {
        if (node.source) check(node, node.source, node.exportKind === "type");
      },
      ImportExpression(node) {
        if (node.source && node.source.type === "Literal") check(node, node.source, false);
      },
    };
  },
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: { haven: { rules: { boundaries: boundariesRule } } },
    rules: { "haven/boundaries": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local practice-mode data.
    ".data/**",
  ]),
]);

export default eslintConfig;
