import { HeartHandshake } from "lucide-react";
import { Notice } from "@/components/ui/Notice";

/**
 * "Every child, everywhere": Haven helps children whatever their nationality, race, religion or
 * background (settings.site.everyChild, editable in Website › Key information). Shown where people
 * ask for help, report a concern, read what a programme does, or give.
 */
export function EveryChildNote({ text, compact, className }: { text: string | null | undefined; compact?: boolean; className?: string }) {
  if (!text?.trim()) return null;
  return (
    <Notice tone="success" icon={HeartHandshake} title="Every child, everywhere" compact={compact} className={className}>
      {text}
    </Notice>
  );
}
