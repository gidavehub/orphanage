"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLenis } from "@/lib/motion/SmoothScroll";
import { cn } from "@/lib/cn";

/** Full-screen video player (the "Watch Video" / play-button target). */
export function VideoLightbox({
  open,
  onClose,
  src,
  poster,
  title,
}: {
  open: boolean;
  onClose: () => void;
  src: string;
  poster?: string;
  title: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const lenis = useLenis();

  useEffect(() => {
    const v = video.current;
    if (!open) {
      v?.pause();
      return;
    }
    lenis?.stop();
    closeBtn.current?.focus();
    v?.play().catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      lenis?.start();
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, lenis]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className={cn(
        "fixed inset-0 z-[90] grid place-items-center bg-night/90 p-4 backdrop-blur-sm transition-[opacity,visibility] duration-500",
        open ? "visible opacity-100" : "invisible opacity-0",
      )}
      onClick={onClose}
    >
      <button
        ref={closeBtn}
        type="button"
        onClick={onClose}
        aria-label="Close video"
        className="absolute right-5 top-5 grid size-12 place-items-center rounded-full bg-marigold text-white transition-transform duration-500 hover:rotate-90"
      >
        <X strokeWidth={2.5} />
      </button>
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-5xl overflow-hidden rounded-3xl bg-black shadow-2xl transition-transform duration-700 ease-out-expo",
          open ? "scale-100" : "scale-90",
        )}
      >
        <video ref={video} src={open ? src : undefined} poster={open ? poster : undefined} controls playsInline className="aspect-video w-full" />
      </div>
    </div>
  );
}
