// Content access: who may edit which record and which fields (content-model §5.3, PLAN D84–D85).
// Isomorphic: the admin uses it to grey out fields ("Ask the finance team to change this"); the write
// pipeline uses it to enforce. Roles decide field groups; the permission checks (content.edit,
// content.publish, post.publish, …) happen in requireStaff first.

import type { CollectionName, DocId } from "./ids";
import { COLLECTIONS, DOCS, type CollectionSpec, type DocSpec, type FieldGroup } from "./registry";
import type { Role } from "@/lib/model/permissions";

const isSuperAdmin = (roles: readonly Role[]) => roles.includes("super_admin");
const intersects = (roles: readonly Role[], allowed: readonly Role[]) => roles.some((r) => allowed.includes(r));

/** May this person open and edit the singleton at all? */
export function canEditDoc(roles: readonly Role[], id: DocId): boolean {
  return isSuperAdmin(roles) || intersects(roles, DOCS[id].edit);
}

/** May this person edit items of the collection at all? */
export function canEditCollection(roles: readonly Role[], c: CollectionName): boolean {
  return isSuperAdmin(roles) || intersects(roles, COLLECTIONS[c].edit);
}

/** May this person add new items? (Programmes and policies are a fixed set.) */
export function canCreateItem(roles: readonly Role[], c: CollectionName): boolean {
  const spec = COLLECTIONS[c];
  if (spec.fixedIds) return false;
  return isSuperAdmin(roles) || intersects(roles, spec.create);
}

function pathMatches(pattern: string, path: string): boolean {
  if (pattern === "*") return true;
  return path === pattern || path.startsWith(`${pattern}.`);
}

/**
 * The field group that governs `path`: the first group whose paths match and whose `when` applies
 * to the record before or after the change.
 */
export function groupFor(spec: DocSpec | CollectionSpec, path: string, ctx: { before?: unknown; after?: unknown } = {}): FieldGroup | null {
  for (const g of spec.fieldGroups) {
    if (g.when && !(g.when(ctx.before) || g.when(ctx.after))) continue;
    if (g.paths.some((p) => pathMatches(p, path))) return g;
  }
  return null;
}

/**
 * The changed paths this person may not change. Empty = allowed. Super admins may change anything
 * except groups that are workflow-only (`edit: []`), which no one changes through a plain save.
 */
export function deniedPaths(
  roles: readonly Role[],
  spec: DocSpec | CollectionSpec,
  changedPaths: readonly string[],
  ctx: { before?: unknown; after?: unknown } = {},
): string[] {
  const denied: string[] = [];
  for (const path of changedPaths) {
    const g = groupFor(spec, path, ctx);
    if (!g) {
      if (!isSuperAdmin(roles) && !intersects(roles, spec.edit)) denied.push(path);
      continue;
    }
    if (g.edit.length === 0) {
      denied.push(path);
      continue;
    }
    if (!isSuperAdmin(roles) && !intersects(roles, g.edit)) denied.push(path);
  }
  return denied;
}

/** The plain-words reason for the first denied path ("Only the finance team can change goals."). */
export function deniedMessage(spec: DocSpec | CollectionSpec, denied: readonly string[], ctx: { before?: unknown; after?: unknown } = {}): string {
  for (const path of denied) {
    const g = groupFor(spec, path, ctx);
    if (g) return g.message;
  }
  return "You don't have access to change this.";
}

/**
 * Whether one field is editable for these roles (the admin greys out the rest). `data` is the
 * record as loaded, so conditional groups (locked FAQs, finance stats) apply.
 */
export function canEditPath(roles: readonly Role[], spec: DocSpec | CollectionSpec, path: string, data?: unknown): boolean {
  return deniedPaths(roles, spec, [path], { before: data, after: data }).length === 0;
}

/** Field groups and whether each is open to these roles, for the admin's helper text. */
export function editableGroups(roles: readonly Role[], spec: DocSpec | CollectionSpec, data?: unknown): Array<{ group: FieldGroup; editable: boolean }> {
  return spec.fieldGroups
    .filter((g) => !g.when || g.when(data))
    .map((g) => ({ group: g, editable: g.edit.length > 0 && (isSuperAdmin(roles) || intersects(roles, g.edit)) }));
}

/** Programme/finance/organisation stats: who may verify (D47). */
export function canVerifyStat(roles: readonly Role[], kind: "programme" | "finance" | "organisation"): boolean {
  if (isSuperAdmin(roles)) return true;
  return kind === "finance" ? roles.includes("finance_officer") : roles.includes("programme_officer");
}
