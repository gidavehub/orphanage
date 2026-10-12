"use client";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";

/**
 * The calm "not switched on yet" body for UI seams that later packages fill (PLAN §5.0: a stub
 * degrades gracefully and never throws). Used by the global sheet stubs and the record view stubs.
 */
export function ComingSoonPanel({ title = "This isn't switched on yet", body, compact = true }: { title?: string; body: React.ReactNode; compact?: boolean }) {
  return <EmptyState art="sprig" compact={compact} title={title} body={body} headingLevel={3} />;
}

/** A global sheet that explains the feature is on its way, with one way out. */
export function ComingSoonSheet({
  open,
  onClose,
  title,
  description,
  body,
  tone,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  body: React.ReactNode;
  tone?: "default" | "restricted";
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      tone={tone}
      size="md"
      footer={
        <Button type="button" variant="quiet" size="sm" icon="none" onClick={onClose}>
          Close
        </Button>
      }
    >
      <ComingSoonPanel body={body} />
    </Sheet>
  );
}
