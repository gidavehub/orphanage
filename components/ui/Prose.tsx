import { cn } from "@/lib/cn";

export type ProseProps = {
  children: React.ReactNode;
  /** `md` 17px (default), `lg` 18px. */
  size?: "md" | "lg";
  /** Constrain to the reading measure (720px). Default true. */
  measure?: boolean;
  as?: "div" | "article" | "section";
  id?: string;
  className?: string;
};

/**
 * Long-form copy (policies, articles, programme overviews, the admin editor surface): the
 * `prose-haven` utility in globals.css, so what staff see in the editor is what gets published.
 */
export function Prose({ children, size = "md", measure = true, as: As = "div", id, className }: ProseProps) {
  return (
    <As id={id} className={cn("prose-haven", size === "lg" && "prose-lg", measure && "max-w-reading", className)}>
      {children}
    </As>
  );
}
