"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

// GSAP is reserved for scroll-scrubbed / pinned work (Focus pin, Manifesto parallax,
// Join sphere). Simple reveals, counters and line drawings use IntersectionObserver + CSS.

let registered = false;

export function registerGsap() {
  if (registered || typeof window === "undefined") return;
  gsap.registerPlugin(ScrollTrigger, useGSAP);
  gsap.defaults({ ease: "power3.out", duration: 0.9 });
  if (process.env.NODE_ENV !== "production") Object.assign(window, { __gsap: gsap, __ST: ScrollTrigger });
  registered = true;
}

registerGsap();

export { gsap, ScrollTrigger, useGSAP };

// Lives in a GSAP-free module so light components can ask without loading GSAP.
export { prefersReducedMotion } from "./useReducedMotion";
