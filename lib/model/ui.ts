// Plain props shared by UI primitives (PLAN D27). components/ui/** take these, never content or
// server types; server parents map view-models to them.

export type UiImage = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  blurDataURL?: string;
  /** Focal point in percent (0–100) for object-position. */
  focal?: { x: number; y: number };
  /** AI-generated image with people visible: render the "Illustrative image" credit (D54). */
  illustrative?: boolean;
  /** Purely decorative: render with alt="" and aria-hidden. */
  decorative?: boolean;
};

export type UiVideo = { src: string; poster: string; label?: string };

/** Brand tones used by cards, discs, allocation bars and feature panels. */
export const TONES = ["forest", "marigold", "clay", "cocoa", "coral", "umber", "deep"] as const;
export type Tone = (typeof TONES)[number];

/** Tone of one line in a cause's "where the money goes" breakdown. */
export type AllocationTone = Tone;
