import { africa, countries, regions, world, type Country } from "@/content/world";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { Flag } from "@/components/art/Flag";
import { worldMap } from "@/components/art/world-map";
import { cn } from "@/lib/cn";
import type { HomeView } from "@/lib/content/types";

const HQ = "gm";

/** One slow marquee row of flag pills. Items carry their own trailing margin so -50% loops seamlessly. */
function FlagRow({ list, seconds, reverse }: { list: Country[]; seconds: number; reverse?: boolean }) {
  return (
    <div className="group overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,#000_7%,#000_93%,transparent)]">
      <ul
        className={cn("flex w-max animate-marquee group-hover:[animation-play-state:paused]", reverse && "[animation-direction:reverse]")}
        style={{ animationDuration: `${seconds}s` }}
      >
        {[...list, ...list].map((c, i) => (
          <li
            key={i}
            aria-hidden={i >= list.length || undefined}
            className="mr-3 flex shrink-0 items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 shadow-[0_10px_24px_-18px_rgba(74,44,26,0.55)]"
          >
            <Flag code={c.code} className="size-8 md:size-9" />
            <span className="whitespace-nowrap text-[14px] font-semibold text-ink/80">{c.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Dotted continents with a marker in every country Haven stands with children; The Gambia is head office. */
function PresenceMap() {
  const { width, height, dots, points } = worldMap;
  // Head office last so it paints above its neighbours.
  const ordered = [...countries.filter((c) => c.code !== HQ), ...countries.filter((c) => c.code === HQ)];
  return (
    <div className="relative" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* Static dotted-land layer (scripts/art/world-map.mjs), kept out of the HTML payload. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation to gain */}
      <img src={dots} alt="" width={width} height={height} loading="lazy" decoding="async" className="absolute inset-0 size-full" />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" role="img" aria-labelledby="world-map-title">
        <title id="world-map-title">
          {`Map of the ${countries.length} countries where Haven stands with children, across Africa, Asia, the Arab world, the Americas and the Pacific. Head office: The Gambia.`}
        </title>
        {ordered.map((c) => {
          const [x, y] = points[c.code];
          const hq = c.code === HQ;
          return (
            <g key={c.code} className="world-marker" transform={`translate(${x} ${y})`}>
              <title>{hq ? `${c.name} (head office)` : c.name}</title>
              {hq && <circle r={9} className="world-marker__pulse fill-marigold" />}
              <circle
                className={cn(
                  "world-marker__dot stroke-white",
                  hq ? "fill-marigold [r:11] md:[r:7]" : "fill-clay [r:6] md:[r:3.8]",
                )}
                strokeWidth={1.4}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * Client brief: families of every background and every nation, visible right under the hero. The
 * heading copy is content (`home.world`); the countries stay in content/world.ts (map + flag sprite).
 */
export function WorldFlags({ world: copy }: { world: HomeView["world"] }) {
  const counts = regions.map((r) => [r, countries.filter((c) => c.region === r).length] as const);
  return (
    <section aria-labelledby="world-title" className="paper relative overflow-hidden pb-14 pt-12 md:pb-16 md:pt-14 cv-auto">
      <Reveal className="wrap text-center">
        <Eyebrow>{copy.eyebrow}</Eyebrow>
        <h2 id="world-title" className="mx-auto mt-4 max-w-[760px] text-balance text-[26px] font-extrabold leading-[1.2] text-ink md:text-[34px]">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-[620px] text-[16px] leading-[1.75] text-body">{copy.intro}</p>
      </Reveal>

      <Reveal className="wrap mt-8 md:mt-10" y={30}>
        <div className="mx-auto max-w-[1180px]">
          <PresenceMap />
        </div>
        <ul className="mx-auto mt-5 flex max-w-[900px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] text-body">
          <li className="flex items-center gap-2 font-bold text-ink">
            <span aria-hidden className="size-3 rounded-full bg-marigold ring-2 ring-white" /> Head office · The Gambia
          </li>
          {counts.map(([r, n]) => (
            <li key={r} className="flex items-center gap-2">
              <span aria-hidden className="size-2.5 rounded-full bg-clay ring-2 ring-white" />
              {r} <span className="font-bold text-ink">{n}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <div className="mt-9 grid gap-1">
        <FlagRow list={africa} seconds={170} />
        <FlagRow list={world} seconds={90} reverse />
      </div>
    </section>
  );
}
