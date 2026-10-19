"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { HelpFinder } from "./HelpFinder";

/**
 * The map section's two tabs: where Haven works (the presence map, rendered on the server and passed
 * in) and "Find help near you" (HelpFinder, founder's ask in the 2026-10-19 meeting).
 */
export function MapTabs({ map }: { map: React.ReactNode }) {
  const [tab, setTab] = useState<"where" | "help">("where");
  const tabs = [
    { id: "where", label: "Where Haven works", short: "Our map" },
    { id: "help", label: "Find help near you", short: "Find help" },
  ] as const;
  return (
    <div>
      <div role="tablist" aria-label="Map" className="mx-auto mb-6 flex w-fit gap-1 rounded-full bg-white p-1 shadow-[0_10px_24px_-18px_rgba(74,44,26,0.55)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`map-tab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            aria-controls={`map-panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={cn("min-h-11 rounded-full px-5 text-[15px] font-bold transition-colors", tab === t.id ? "bg-forest text-white" : "text-ink hover:bg-cream")}
          >
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <div id="map-panel-where" role="tabpanel" aria-labelledby="map-tab-where" hidden={tab !== "where"}>
        {map}
      </div>
      <div id="map-panel-help" role="tabpanel" aria-labelledby="map-tab-help" hidden={tab !== "help"}>
        {tab === "help" ? <HelpFinder /> : null}
      </div>
    </div>
  );
}
