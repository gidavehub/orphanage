"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export type AccordionItem = {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
};

export type AccordionProps = {
  items: AccordionItem[];
  /** Ids open at first (the landing FAQ opens its first question). */
  defaultOpen?: string[];
  /** Allow several open at once (default: one at a time, which may also be none). */
  multiple?: boolean;
  /**
   * `card` (default): the landing FAQ look, white rounded cards with a soft shadow and a forest chevron.
   * `flush`: hairline rows with 17/600 titles for policies, eligibility, the mobile TOC and the admin.
   */
  variant?: "card" | "flush";
  headingLevel?: 2 | 3 | 4;
  className?: string;
};

/**
 * Disclosure list extracted from Faq.tsx (design-system §3.6). Buttons carry aria-expanded and
 * aria-controls; panels animate with the grid-rows trick (500ms) and are inert while closed, so
 * hidden links are never tabbable.
 */
export function Accordion({ items, defaultOpen, multiple, variant = "card", headingLevel = 3, className }: AccordionProps) {
  const base = useId();
  const [open, setOpen] = useState<string[]>(() => defaultOpen ?? []);
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";
  const card = variant === "card";

  const toggle = (id: string) =>
    setOpen((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : multiple ? [...xs, id] : [id]));

  return (
    <div className={cn(card ? "grid gap-4" : "border-t border-line", className)}>
      {items.map((item, i) => {
        const on = open.includes(item.id);
        const q = `${base}-q${i}`;
        const a = `${base}-a${i}`;
        return (
          <div key={item.id} className={card ? "rounded-[20px] bg-white px-7 shadow-soft" : "border-b border-line"}>
            <Heading>
              <button
                type="button"
                id={q}
                aria-expanded={on}
                aria-controls={a}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-4 text-left text-ink",
                  card ? "py-6 text-[17px] font-medium md:text-[19px]" : "min-h-14 py-4 text-[17px] font-semibold hover:text-forest",
                )}
              >
                {item.title}
                <ChevronDown aria-hidden className={cn("size-5 shrink-0 text-forest transition-transform duration-500", on && "rotate-180")} />
              </button>
            </Heading>
            <div
              id={a}
              role="region"
              aria-labelledby={q}
              inert={!on}
              className={cn("grid transition-[grid-template-rows] duration-500 ease-out-expo", on ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <div className={card ? "border-t border-line pb-7 pt-5 text-[15px] leading-[1.85] text-body" : "pb-5 text-[16px] leading-[1.75] text-body"}>
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
