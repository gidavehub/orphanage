/**
 * Marks an editable public section for the website studio (PLAN D60, D62; admin-ux §6.10). Always
 * renders `<div data-studio-slot={id} style="display:contents">`, so it never changes layout and never
 * reads anything at runtime: the static shell stays static. In Draft Mode the StudioBridge finds the
 * slots by this attribute and outlines them. `id` is the content doc id ("home.hero").
 */
export function StudioSlot({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <div data-studio-slot={id} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
