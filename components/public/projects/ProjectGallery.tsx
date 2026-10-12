"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { Modal } from "@/components/ui/Modal";
import type { UiImage } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

/**
 * A project's photos (public-pages §3.13): a masonry of rounded pictures; each opens in a lightbox on
 * the shared Modal (native <dialog>: focus trap, Esc, focus returns to the picture) with previous and
 * next buttons and the arrow keys. Illustrative pictures keep their credit in both places (D54).
 */
export function ProjectGallery({ images, title }: { images: UiImage[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const count = images.length;
  const current = open === null ? null : images[open];

  const go = (delta: number) => setOpen((i) => (i === null ? i : (i + delta + count) % count));

  useEffect(() => {
    if (open === null || count < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` only closes over count
  }, [open, count]);

  if (!count) return null;

  return (
    <>
      <ul className="columns-1 gap-5 sm:columns-2 lg:columns-3 [&>li]:mb-5">
        {images.map((img, i) => (
          <li key={`${img.src}-${i}`} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => setOpen(i)}
              aria-label={`Open photo ${i + 1} of ${count}${img.alt && !img.decorative ? `: ${img.alt}` : ""}`}
              className="group relative block w-full overflow-hidden rounded-card focus-visible:ring-4 focus-visible:ring-marigold"
            >
              <Image
                src={img.src}
                alt=""
                width={img.width ?? 1200}
                height={img.height ?? (i % 3 === 1 ? 1500 : 900)}
                sizes="(min-width:1024px) 31vw, (min-width:640px) 46vw, 92vw"
                placeholder={img.blurDataURL ? "blur" : "empty"}
                blurDataURL={img.blurDataURL}
                className="h-auto w-full object-cover transition-transform duration-[1.2s] ease-out-expo group-hover:scale-105"
              />
              <span aria-hidden className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/90 text-night opacity-0 shadow-card transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100">
                <Expand className="size-[18px]" strokeWidth={2.25} />
              </span>
              {img.illustrative ? <ImageCredit position="bottom-left" /> : null}
            </button>
          </li>
        ))}
      </ul>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={`${title}: photo ${(open ?? 0) + 1} of ${count}`}
        size="lg"
        footer={
          count > 1 ? (
            <div className="flex w-full items-center justify-between gap-3">
              <Button variant="outline" size="sm" icon="none" onClick={() => go(-1)}>
                <ChevronLeft aria-hidden className="-ml-1 size-4" strokeWidth={2.5} />
                Previous
              </Button>
              <Button variant="forest" size="sm" icon="none" onClick={() => go(1)}>
                Next
                <ChevronRight aria-hidden className="-mr-1 size-4" strokeWidth={2.5} />
              </Button>
            </div>
          ) : undefined
        }
      >
        {current ? (
          <figure className="m-0">
            <div className={cn("relative overflow-hidden rounded-card bg-paper", "aspect-[4/3]")}>
              <Image
                key={current.src}
                src={current.src}
                alt={current.decorative ? "" : current.alt}
                fill
                sizes="(min-width:800px) 700px, 92vw"
                className="object-contain motion-safe:animate-[hero-rise_0.5s_var(--ease-out-expo)_both]"
              />
              {current.illustrative ? <ImageCredit position="bottom-left" /> : null}
            </div>
            {current.alt && !current.decorative ? <figcaption className="mt-3 text-[15px] leading-relaxed text-body">{current.alt}</figcaption> : null}
          </figure>
        ) : null}
      </Modal>
    </>
  );
}
