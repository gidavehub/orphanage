import Link from "next/link";
import { ArrowRight, MessageCircleQuestion, ShieldAlert, ShoppingBasket } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconDisc } from "@/components/ui/IconDisc";
import { Reveal } from "@/components/ui/Reveal";
import type { DiscIcon } from "@/components/ui/icon";
import type { SupportCategory } from "@/lib/model/enums";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";
import { SUPPORT_CATEGORY_DESCRIPTION } from "./labels";

export type HelpTypeItem = { title: string; text?: string; icon?: string };

/** The hub's icon keys (pages.getSupport → helpTypes.items[].icon) → request category and disc icon. */
const BY_ICON: Record<string, { category: SupportCategory; icon: DiscIcon }> = {
  education: { category: "education", icon: "education" },
  medical: { category: "medical", icon: "medical" },
  psychological: { category: "counselling", icon: "psychological" },
  counselling: { category: "counselling", icon: "psychological" },
  legal: { category: "legal", icon: "legal" },
  food: { category: "food_supplies", icon: ShoppingBasket },
  family: { category: "family_support", icon: "family" },
  other: { category: "other", icon: MessageCircleQuestion },
};

const PROTECTION_KEYS = new Set(["protection", "child-protection"]);

/**
 * "What kind of help do you need?" (public-pages §3.5.2): eight link cards in the RadioCards look.
 * Each goes to the request form with that type preselected. The child-protection card is wider and
 * splits in two: reporting a concern (the default) or asking for protection support for a family.
 */
export function HelpTypeGrid({ items, counsellingOpen = true }: { items: HelpTypeItem[]; counsellingOpen?: boolean }) {
  // Two columns from md: an odd count of ordinary cards leaves the last one alone, so it spans both.
  const regular = items.filter((i) => !PROTECTION_KEYS.has(i.icon ?? "") && BY_ICON[i.icon ?? ""]);
  const lastRegular = regular.length % 2 === 1 ? regular[regular.length - 1] : undefined;
  return (
    <Reveal as="ul" stagger={0.06} y={28} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const key = item.icon ?? "";
        if (PROTECTION_KEYS.has(key)) return <ProtectionCard key={item.title} item={item} />;
        const meta = BY_ICON[key];
        if (!meta) return null;
        const paused = meta.category === "counselling" && !counsellingOpen;
        return (
          <li key={item.title} className={cn("flex", item === lastRegular && "md:col-span-2 xl:col-span-1")}>
            <Link
              href={routes.request(meta.category)}
              className={cn(
                "group relative flex w-full items-start gap-4 rounded-control border-2 border-transparent bg-white p-5 shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-out-expo md:p-6",
                "hover:-translate-y-1 hover:border-forest/25 hover:shadow-card-hover focus-visible:border-forest",
              )}
            >
              <IconDisc icon={meta.icon} size={52} />
              <span className="min-w-0 flex-1 pr-9">
                <span className="block text-[17px] font-bold leading-snug text-ink">{item.title}</span>
                <span className="mt-1 block text-[14px] leading-relaxed text-body">
                  {paused ? "New counselling requests are paused for now. Please call or email us." : (item.text ?? SUPPORT_CATEGORY_DESCRIPTION[meta.category])}
                </span>
              </span>
              <span
                aria-hidden
                className="absolute right-4 top-5 grid size-9 place-items-center rounded-full bg-paper text-forest transition-[background-color,color,transform] duration-300 ease-out-expo group-hover:translate-x-0.5 group-hover:bg-forest group-hover:text-white md:top-6"
              >
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </span>
            </Link>
          </li>
        );
      })}
    </Reveal>
  );
}

function ProtectionCard({ item }: { item: HelpTypeItem }) {
  return (
    <li className="md:col-span-2 xl:col-span-2 xl:row-span-1">
      <div className="relative flex h-full flex-col gap-5 overflow-hidden rounded-control border-2 border-coral-800 bg-white p-5 shadow-card sm:flex-row sm:items-start md:p-6">
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-coral-100/70" />
        <IconDisc icon={ShieldAlert} size={52} tone="urgent" halo="none" className="relative" />
        <div className="relative min-w-0 flex-1">
          <h3 className="text-[19px] font-extrabold leading-snug text-coral-800">{item.title}</h3>
          <p className="mt-1 max-w-[520px] text-[15px] leading-relaxed text-body">
            {item.text ?? "Report a concern about a child, or ask for protection support for your family."}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Button href={routes.concern()} variant="flame-ink" size="sm" icon="arrow-right">
              Report a concern about a child
            </Button>
            <Link
              href={routes.request("child_protection")}
              className="group/link inline-block py-2.5 text-[15px] font-bold leading-snug text-forest underline decoration-marigold decoration-2 underline-offset-4 transition-colors hover:text-ink sm:px-1"
            >
              Ask for protection support for my family
              <ArrowRight aria-hidden className="ml-1.5 inline size-4 align-[-3px] transition-transform group-hover/link:translate-x-0.5" strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
