"use client";

import Image from "next/image";
import { useCallback, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ArrowLeft, ArrowRight, BookOpenText, Languages } from "lucide-react";
import { SocialIcon } from "@/components/art/SocialIcons";
import { PersonCard } from "@/components/ui/cards/PersonCard";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Sheet } from "@/components/ui/Sheet";
import type { UiImage } from "@/lib/model/ui";

export type TeamGalleryMember = {
  id: string;
  name: string;
  role: string;
  image: UiImage;
  /** Real profile links only ("#" placeholders are dropped by the page). */
  socials: Array<{ icon: string; href: string }>;
  languages: string[];
  /** The biography, rendered on the server (Blocks). */
  bio: React.ReactNode;
  hasBio: boolean;
};

const SOCIAL_NAME: Record<string, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  x: "X",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  whatsapp: "WhatsApp",
};

/**
 * The About page's team (public-pages §3.2.7; PLAN D50, D120 BioDrawer → Sheet): the landing's arch
 * cards in the same carousel, each with a "Read bio" button that opens a Sheet with the portrait,
 * role, biography, languages and profile links. The Sheet is a native modal dialog: it traps focus,
 * closes on Esc and returns focus to the button that opened it. No personal phone numbers or emails.
 */
export function TeamGallery({ members }: { members: TeamGalleryMember[] }) {
  const [viewport, api] = useEmblaCarousel({ loop: members.length > 4, align: "start", duration: 30 });
  const prev = useCallback(() => api?.scrollPrev(), [api]);
  const next = useCallback(() => api?.scrollNext(), [api]);
  const [openId, setOpenId] = useState<string | null>(null);
  const open = members.find((m) => m.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);

  return (
    <>
      <div className="relative md:px-20">
        <button
          type="button"
          onClick={prev}
          aria-label="Previous team member"
          className="absolute left-0 top-[42%] z-10 hidden size-14 -translate-y-1/2 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-marigold hover:text-night md:grid"
        >
          <ArrowLeft strokeWidth={2.5} className="size-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="Next team member"
          className="absolute right-0 top-[42%] z-10 hidden size-14 -translate-y-1/2 place-items-center rounded-full bg-forest text-white transition-colors hover:bg-marigold hover:text-night md:grid"
        >
          <ArrowRight strokeWidth={2.5} className="size-5" />
        </button>

        <div ref={viewport} className="overflow-hidden pt-4" role="region" aria-roledescription="carousel" aria-label="Team members">
          <ul className="-ml-6 flex">
            {members.map((m, i) => (
              <li key={m.id} aria-roledescription="slide" aria-label={`${i + 1} of ${members.length}`} className="min-w-0 shrink-0 grow-0 basis-[82%] pl-6 sm:basis-1/2 lg:basis-1/3 xl:basis-1/4">
                <PersonCard
                  name={m.name}
                  role={m.role}
                  image={m.image}
                  socials={m.socials}
                  action={
                    <button
                      type="button"
                      onClick={() => setOpenId(m.id)}
                      aria-haspopup="dialog"
                      className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[14px] font-bold text-forest shadow-thumb transition-colors duration-300 hover:bg-marigold hover:text-night"
                    >
                      <BookOpenText aria-hidden className="size-4" strokeWidth={2.25} />
                      Read bio<span className="sr-only">: {m.name}</span>
                    </button>
                  }
                />
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Sheet open={!!open} onClose={close} title={open?.name ?? ""} description={open?.role} size="md">
        {open ? (
          <div className="grid gap-6">
            <div className="relative mx-auto aspect-[265/235] w-full max-w-[320px] overflow-hidden rounded-b-[18px] rounded-t-[160px] bg-mint">
              <Image src={open.image.src} alt={open.image.decorative ? "" : open.image.alt || `${open.name}, ${open.role}`} fill sizes="320px" className="object-cover object-top" />
              {open.image.illustrative ? <ImageCredit position="bottom-left" /> : null}
            </div>

            {open.hasBio ? (
              <div className="text-[16px] leading-[1.75] text-ink [&_p+p]:mt-4">{open.bio}</div>
            ) : (
              <p className="text-[16px] leading-[1.75] text-body">{open.name.split(" ")[0]}&apos;s full biography is coming soon.</p>
            )}

            {open.languages.length ? (
              <div className="rounded-card bg-white p-5">
                <p className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                  <Languages aria-hidden className="size-5 text-forest" strokeWidth={2.25} />
                  Speaks
                </p>
                <ul className="mt-3 flex flex-wrap gap-2" aria-label={`Languages ${open.name} speaks`}>
                  {open.languages.map((l) => (
                    <li key={l} className="rounded-full bg-mint px-3.5 py-1.5 text-[14px] font-bold text-forest-700">
                      {l}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {open.socials.length ? (
              <div>
                <p className="text-[15px] font-extrabold text-ink">Find {open.name.split(" ")[0]} online</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {open.socials.map((s) => (
                    <li key={`${s.icon}-${s.href}`}>
                      <a
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-white px-4 text-[14px] font-bold text-ink transition-colors hover:border-forest hover:text-forest"
                      >
                        <SocialIcon name={s.icon} className="size-4" />
                        {SOCIAL_NAME[s.icon] ?? s.icon}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </Sheet>
    </>
  );
}
