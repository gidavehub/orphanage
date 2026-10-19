"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * "Find help near you" (founder, 2026-10-19 meeting: "if they're in that region, they can identify
 * this hospital, this police agency… we'll add that tab to it"). A town, or the device's location,
 * and what to look for; Google Maps shows the nearest places. Nothing loads from Google until someone
 * searches, and the location goes from the browser to Google Maps only, never to Haven.
 */
const KINDS = [
  { id: "hospital", label: "Hospitals & clinics", query: "hospital" },
  { id: "police", label: "Police", query: "police station" },
  { id: "protection", label: "Child protection", query: "child protection services" },
  { id: "shelter", label: "Shelters", query: "shelter for women and children" },
  { id: "pharmacy", label: "Pharmacies", query: "pharmacy" },
] as const;

type Where = { kind: "place"; text: string } | { kind: "here"; lat: number; lon: number };

export function HelpFinder() {
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("hospital");
  const [text, setText] = useState("");
  const [where, setWhere] = useState<Where | null>(null);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const what = KINDS.find((k) => k.id === kind)!;
  const query = where ? (where.kind === "place" ? `${what.query} near ${where.text}` : `${what.query} near ${where.lat.toFixed(4)},${where.lon.toFixed(4)}`) : null;
  const embed = query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&z=13&output=embed` : null;
  const open = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;

  function search(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) {
      setNote("Type your town, city or area, or use your location.");
      return;
    }
    setNote(null);
    setWhere({ kind: "place", text: t.slice(0, 120) });
  }

  function here() {
    if (!("geolocation" in navigator)) {
      setNote("This device can't share its location. Type your town or area instead.");
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setWhere({ kind: "here", lat: pos.coords.latitude, lon: pos.coords.longitude });
      },
      () => {
        setLocating(false);
        setNote("We couldn't get your location. Type your town or area instead.");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  return (
    <div className="mx-auto grid max-w-[1180px] gap-5 rounded-[28px] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(74,44,26,0.45)] md:grid-cols-[minmax(0,360px)_1fr] md:p-7">
      <div className="grid content-start gap-4 text-left">
        <div>
          <h3 className="text-[20px] font-extrabold leading-snug text-ink">Find help near you</h3>
          <p className="mt-1.5 text-[15px] leading-relaxed text-body">Wherever you are, find the nearest hospital, police station or safe place for a child.</p>
        </div>

        <div role="radiogroup" aria-label="What to find" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={cn(
                "min-h-10 rounded-full border px-3.5 text-[14px] font-bold transition-colors",
                kind === k.id ? "border-forest bg-forest text-white" : "border-line bg-white text-ink hover:border-forest",
              )}
            >
              {k.label}
            </button>
          ))}
        </div>

        <form onSubmit={search} className="grid gap-2.5">
          <label htmlFor="help-place" className="text-[14px] font-bold text-ink">
            Your town, city or area
          </label>
          <div className="flex gap-2">
            <input
              id="help-place"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="For example, Serekunda or Atlanta"
              autoComplete="address-level2"
              className="min-h-12 w-full min-w-0 rounded-full border-[1.5px] border-edge bg-white px-4 text-[15px] text-ink focus:border-forest focus:outline-none focus:ring-4 focus:ring-forest/15"
            />
            <button type="submit" className="min-h-12 shrink-0 rounded-full bg-forest px-5 text-[15px] font-bold text-white hover:bg-forest-700">
              Search
            </button>
          </div>
          <button type="button" onClick={here} disabled={locating} className="w-fit text-[14px] font-bold text-forest underline underline-offset-4 disabled:opacity-60">
            {locating ? "Finding your location…" : "Use my location"}
          </button>
          {note ? <p role="status" className="text-[14px] text-clay-700">{note}</p> : null}
        </form>

        <p className="rounded-2xl bg-sand px-4 py-3 text-[14px] leading-relaxed text-umber">
          <span className="font-bold">In an emergency, call your local emergency number now.</span> You can also{" "}
          <a href="/get-support" className="font-bold underline underline-offset-4">
            ask Haven for support
          </a>
          .
        </p>
        <p className="text-[12.5px] leading-relaxed text-body">Results come from Google Maps. Your location stays between your device and Google, and is never sent to Haven.</p>
      </div>

      <div className="relative min-h-[320px] overflow-hidden rounded-[22px] bg-cream md:min-h-[420px]">
        {embed ? (
          <>
            <iframe
              key={embed}
              title={`Map: ${what.label.toLowerCase()} near ${where?.kind === "place" ? where.text : "you"}`}
              src={embed}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="absolute inset-0 size-full border-0"
            />
            <a
              href={open!}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 rounded-full bg-white px-4 py-2 text-[14px] font-bold text-forest shadow-soft hover:bg-mint"
            >
              Open in Google Maps
            </a>
          </>
        ) : (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <p className="max-w-[320px] text-[15px] leading-relaxed text-body">Choose what you need and type your town, or use your location. The nearest places will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
