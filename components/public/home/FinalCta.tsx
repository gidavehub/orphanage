import { CtaBand } from "@/components/layout/CtaBand";
import { Button } from "@/components/ui/Button";
import type { HomeView } from "@/lib/content/types";

/**
 * The landing's closing call to action (D128): the coral CtaBand after News, with the content team's
 * title, optional line and up to three buttons. The first button is the solid white heart CTA; the
 * others are Voices United outlines, exactly as the band's own defaults. The page renders it only
 * while `home.finalCta.visible` is on.
 */
export function FinalCta({ finalCta }: { finalCta: HomeView["finalCta"] }) {
  const buttons = finalCta.buttons.slice(0, 3);
  return (
    <CtaBand
      id="final-cta-title"
      title={finalCta.title}
      text={finalCta.text ?? ""}
      actions={
        buttons.length
          ? buttons.map((b, i) =>
              i === 0 ? (
                <Button key={`${b.to}-${i}`} href={b.href} variant="vu-white" size="lg" icon="heart" iconFirst className="min-w-[200px]">
                  {b.label}
                </Button>
              ) : (
                <Button key={`${b.to}-${i}`} href={b.href} variant="vu-outline" size="lg" icon="none" className="min-w-[200px]">
                  {b.label}
                </Button>
              ),
            )
          : undefined
      }
    />
  );
}
