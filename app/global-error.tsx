"use client";

import { useEffect } from "react";
import "./globals.css";

// Last-resort error UI when the root layout itself fails (PLAN D10). It replaces the root layout, so
// it brings its own <html> and <body> and the global styles (system fonts stand in for the web fonts).
// No data reads, no chrome: just a calm way back. `retry` re-fetches and re-renders (Next 16.3).
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error("[haven] root error", error.digest ?? "");
  }, [error]);

  return (
    <html lang="en">
      <body className="paper">
        <title>Something went wrong | Haven</title>
        <main id="main" className="flex min-h-dvh items-center justify-center px-4 py-16 focus-forest">
          <div className="w-full max-w-[560px] rounded-card-lg bg-white p-8 text-center shadow-modal md:p-12">
            <p className="font-script text-[26px] font-bold text-marigold-ink">Sorry about this</p>
            <h1 className="mt-2 text-[30px] font-extrabold leading-tight text-ink md:text-[36px]">Something went wrong on our side</h1>
            <p className="mt-4 text-[17px] leading-relaxed text-body">Please try again in a moment. If it keeps happening, come back a little later.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-11 items-center rounded-full bg-forest px-7 text-[14px] font-bold text-white transition-colors hover:bg-marigold hover:text-night"
              >
                Try again
              </button>
              {/* A plain link: the app shell itself failed, so do a full page load. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/" className="inline-flex h-11 items-center rounded-full border border-ink/80 px-7 text-[14px] font-bold text-ink transition-colors hover:border-forest hover:bg-forest hover:text-white">
                Go to the home page
              </a>
            </div>
            <p className="mt-8 rounded-2xl bg-deep px-5 py-4 text-left text-[14px] leading-relaxed text-white/90">
              If a child is in immediate danger, contact the appropriate emergency, law-enforcement or child-protection authority
              immediately.
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
