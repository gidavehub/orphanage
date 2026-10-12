"use client";

import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Chips } from "@/components/ui/form/Chips";
import { EmptyState } from "@/components/ui/EmptyState";
import { StoryCard } from "@/components/ui/cards/StoryCard";
import { useToast } from "@/components/ui/Toast";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type WallStory = {
  id: string;
  label: string;
  meta: string;
  text: string;
  image: UiImage;
  place: { code: string; name: string } | null;
  /** Programme id, for the filter. */
  programme: string | null;
};

type Props = {
  stories: WallStory[];
  /** Programme filter pills: only programmes that have stories. */
  programmes: Array<{ id: string; label: string }>;
  /** The page path the copied anchors point to ("/stories"). */
  path: string;
};

// Masonry rhythm: alternate card heights so the columns interlock.
const HEIGHTS = ["h-[440px]", "h-[380px]", "h-[480px]", "h-[400px]", "h-[460px]", "h-[370px]"];

function CopyLink({ id, label, path }: { id: string; label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const { toast, available } = useToast();
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    const url = new URL(`${path}#s-${id}`, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (available) toast({ title: "Link to this story copied", tone: "success" });
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? `Link to the story of ${label} copied` : `Copy a link to the story of ${label}`}
      className="absolute right-4 top-4 z-[2] grid size-11 place-items-center rounded-full border border-white/50 bg-night/30 text-white backdrop-blur transition-[background-color,transform] duration-300 hover:scale-105 hover:bg-white hover:text-night focus-visible:bg-white focus-visible:text-night"
    >
      {copied ? <Check aria-hidden className="size-5" strokeWidth={3} /> : <Link2 aria-hidden className="size-5" strokeWidth={2.25} />}
    </button>
  );
}

/**
 * All stories (public-pages §3.14): a masonry of picture-and-paragraph cards, each with an anchor
 * (`#s-<id>`) and a "Copy link" button, filtered by programme in place. A shared anchor highlights
 * its card on arrival.
 */
export function StoryWall({ stories, programmes, path }: Props) {
  const [programme, setProgramme] = useState("all");
  const [target, setTarget] = useState<string | null>(null);
  const shown = programme === "all" ? stories : stories.filter((s) => s.programme === programme);

  useEffect(() => {
    const read = () => {
      const m = /^#s-([A-Za-z0-9_~.-]+)$/.exec(window.location.hash);
      setTarget(m ? m[1] : null);
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  useEffect(() => {
    if (!target) return;
    const t = setTimeout(() => setTarget(null), 4000);
    return () => clearTimeout(t);
  }, [target]);

  const options = [{ value: "all", label: "All stories" }, ...programmes.map((p) => ({ value: p.id, label: p.label }))];
  const current = programmes.find((p) => p.id === programme)?.label;

  return (
    <div>
      {programmes.length > 1 ? (
        <Chips options={options} label="Filter stories by programme" tone="clay" value={programme} onChange={setProgramme} align="center" scroll />
      ) : null}
      <p aria-live="polite" className="sr-only">
        {programme === "all" ? `Showing all ${shown.length} stories` : `Showing ${shown.length} ${shown.length === 1 ? "story" : "stories"} about ${current}`}
      </p>

      {shown.length ? (
        <ul className="mt-10 columns-1 gap-6 sm:columns-2 lg:columns-3 [&>li]:mb-6">
          {shown.map((s, i) => (
            <li
              key={s.id}
              id={`s-${s.id}`}
              className={cn(
                "relative break-inside-avoid scroll-mt-32 rounded-[36px] transition-shadow duration-700 motion-safe:animate-[hero-rise_0.6s_var(--ease-out-expo)_both]",
                target === s.id && "ring-4 ring-marigold ring-offset-4 ring-offset-paper",
              )}
              style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
            >
              <StoryCard
                image={{ ...s.image, alt: s.image.decorative ? "" : s.image.alt }}
                label={s.label}
                meta={s.meta}
                {...(s.place ? { place: s.place } : {})}
                text={s.text}
                sizes="(min-width:1024px) 31vw, (min-width:640px) 46vw, 92vw"
                className={HEIGHTS[i % HEIGHTS.length]}
              />
              <CopyLink id={s.id} label={s.label} path={path} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          art="hearts"
          title={`No ${current ?? ""} stories yet.`.replace("  ", " ")}
          body="New stories are added as families give their permission. Please choose another programme."
          className="mt-10"
        />
      )}
    </div>
  );
}
