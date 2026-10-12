import { Eyebrow } from "@/components/ui/Eyebrow";
import { DonatHeading } from "@/components/ui/SectionHeading";
import { Button } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { ArticleCard } from "@/components/ui/cards/ArticleCard";
import { UpdateCard } from "@/components/ui/cards/UpdateCard";
import type { HomeView } from "@/lib/content/types";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/cn";

type Props = {
  section: HomeView["news"]["section"];
  news: HomeView["news"]["posts"];
  /** The last section before the Footer keeps room for its torn edge (default true). */
  last?: boolean;
};

/** ISO date for <time dateTime> from a Millis timestamp (deterministic, no clock read). */
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Donat "Our Latest News & Articles": the three newest posts (or the content team's picks). Articles
 * use the landing ArticleCard; quick picture-and-paragraph updates use the compact UpdateCard (D43).
 */
export function News({ section, news, last = true }: Props) {
  return (
    <section id="news" aria-labelledby="news-title" className={cn("bg-white pt-10 cv-auto", last ? "pb-40 md:pb-48" : "pb-24 md:pb-32")}>
      <div className="wrap">
        <Reveal className="text-center">
          <Eyebrow>{section.eyebrow}</Eyebrow>
          <DonatHeading id="news-title" lines={section.lines} className="mt-4" />
          <p className="mx-auto mt-4 max-w-[520px] text-[16px] leading-[1.75] text-body">{section.intro}</p>
        </Reveal>
        <Reveal stagger={0.12} className="mt-14 grid gap-7 md:grid-cols-3">
          {news.map((n) =>
            n.format === "update" ? (
              <UpdateCard
                key={n.id}
                title={n.title}
                date={n.dateLabel}
                dateTime={isoDay(n.publishedAt)}
                text={n.excerpt}
                image={n.cover}
                category={n.categoryLabel}
                href={n.href}
                className="self-start"
              />
            ) : (
              <ArticleCard
                key={n.id}
                title={n.title}
                date={n.dateLabel}
                dateTime={isoDay(n.publishedAt)}
                category={n.categoryLabel}
                image={n.cover}
                href={n.href}
                cta={section.cardCta}
              />
            ),
          )}
        </Reveal>
        <div className="mt-12 flex justify-center">
          <Button href={routes.news()} variant="outline" size="md" icon="none">
            View All News
          </Button>
        </div>
      </div>
    </section>
  );
}
