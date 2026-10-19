import { africa, countries, places, regions, world, type Country } from "@/content/world";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Reveal } from "@/components/ui/Reveal";
import { Flag } from "@/components/art/Flag";
import { worldMap } from "@/components/art/world-map";
import { MapTabs } from "./MapTabs";
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

/**
 * A small raised hand: the map's marker (founder, 2026-10-19: "on the map we'll add those dots…
 * with the hands… black, white, green, yellow, just little hands"). Drawn round (0, 0), about 13
 * units tall, in one of the hand colours; white hands get a clay outline so they read on paper.
 */
const HAND_TONES = [
  "fill-ink stroke-white",
  "fill-white stroke-clay",
  "fill-forest stroke-white",
  "fill-marigold stroke-white",
  "fill-clay stroke-white",
] as const;

function Hand({ tone, className }: { tone: string; className?: string }) {
  return (
    <g className={cn("world-marker__dot", tone, className)} strokeWidth={0.9} paintOrder="stroke" strokeLinejoin="round">
      {/* Palm, four fingers and a thumb. */}
      <rect x={-3.6} y={-1} width={7.2} height={6.6} rx={3} />
      <rect x={-3.6} y={-6.6} width={1.7} height={6.6} rx={0.85} />
      <rect x={-1.7} y={-7.6} width={1.7} height={7.4} rx={0.85} />
      <rect x={0.2} y={-7.1} width={1.7} height={7} rx={0.85} />
      <rect x={2.1} y={-5.6} width={1.6} height={5.6} rx={0.8} />
      <rect x={-6.3} y={-0.6} width={1.7} height={5} rx={0.85} transform="rotate(-38 -5.4 1.9)" />
    </g>
  );
}

/** Dotted continents with a hand in every country Haven stands with children, and pins for the US cities and states; The Gambia is head office. */
function PresenceMap() {
  const { width, height, dots, points } = worldMap;
  // Head office last so it paints above its neighbours.
  const shown = countries.filter((c) => !c.pinsOnly);
  const ordered = [...shown.filter((c) => c.code !== HQ), ...shown.filter((c) => c.code === HQ)];
  const markers = [
    ...ordered.map((c) => ({ key: c.code, label: c.code === HQ ? `${c.name} (head office)` : c.name, hq: c.code === HQ })),
    ...places.map((p) => ({ key: p.id, label: `${p.name}, United States`, hq: false })),
  ];
  return (
    <div className="relative" style={{ aspectRatio: `${width} / ${height}` }}>
      {/* Static dotted-land layer (scripts/art/world-map.mjs), kept out of the HTML payload. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no optimisation to gain */}
      <img src={dots} alt="" width={width} height={height} loading="lazy" decoding="async" className="absolute inset-0 size-full" />
      <svg viewBox={`0 0 ${width} ${height}`} className="absolute inset-0 size-full" role="img" aria-labelledby="world-map-title">
        <title id="world-map-title">
          {`Map of the ${countries.length} countries where Haven stands with children, across Africa, Asia, the Arab world, the Americas and the Pacific, with ${places.length} cities and states in the United States. Head office: The Gambia.`}
        </title>
        {markers.map((m, i) => {
          const [x, y] = points[m.key];
          return (
            <g key={m.key} className="world-marker" transform={`translate(${x} ${y})`}>
              <title>{m.label}</title>
              {m.hq && <circle r={9} className="world-marker__pulse fill-marigold" />}
              {/* Bigger on phones, where the whole map is small. */}
              <g className={m.hq ? "scale-[1.9] md:scale-[1.25]" : "scale-[1.25] md:scale-[0.78]"}>
                <Hand tone={m.hq ? "fill-marigold stroke-white" : HAND_TONES[i % HAND_TONES.length]} />
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** The legend's hand, the same shape as the map's. */
function HandIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="-8 -9 16 16" className={cn("size-4 stroke-white", className)} strokeWidth={0.9} paintOrder="stroke">
      <rect x={-3.6} y={-1} width={7.2} height={6.6} rx={3} />
      <rect x={-3.6} y={-6.6} width={1.7} height={6.6} rx={0.85} />
      <rect x={-1.7} y={-7.6} width={1.7} height={7.4} rx={0.85} />
      <rect x={0.2} y={-7.1} width={1.7} height={7} rx={0.85} />
      <rect x={2.1} y={-5.6} width={1.6} height={5.6} rx={0.8} />
      <rect x={-6.3} y={-0.6} width={1.7} height={5} rx={0.85} transform="rotate(-38 -5.4 1.9)" />
    </svg>
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
        <MapTabs
          map={
            <>
              <div className="mx-auto max-w-[1180px]">
                <PresenceMap />
              </div>
              <ul className="mx-auto mt-5 flex max-w-[900px] flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[14px] text-body">
                <li className="flex items-center gap-2 font-bold text-ink">
                  <HandIcon className="fill-marigold" /> Head office · The Gambia
                </li>
                {counts.map(([r, n], i) => (
                  <li key={r} className="flex items-center gap-2">
                    <HandIcon className={["fill-ink", "fill-forest", "fill-clay", "fill-marigold", "fill-cocoa"][i % 5]} />
                    {r} <span className="font-bold text-ink">{n}</span>
                  </li>
                ))}
              </ul>
              <p className="mx-auto mt-3 max-w-[760px] text-center text-[14px] leading-relaxed text-body">
                In the United States: <span className="font-semibold text-ink">{places.map((p) => p.name.replace(/, .*$/, "")).join(", ")}</span>.
              </p>
            </>
          }
        />
      </Reveal>

      <div className="mt-9 grid gap-1">
        <FlagRow list={africa} seconds={170} />
        <FlagRow list={world} seconds={90} reverse />
      </div>
    </section>
  );
}
