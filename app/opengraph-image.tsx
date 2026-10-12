import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { getContent, getSiteSettings } from "@/lib/content/public";

// The site-wide share image (PLAN §5.5 day-0 fix, next16 §2.2 item 4). The fonts and the backdrop never
// change, so they are read once at module scope ("predictable values") and the image stays
// prerendered. The headline lines and tagline come from the cached settings (settings.seo,
// settings.site). P8 owns the per-page images.

const [anton, nunito, bg] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Nunito-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/og-bg.jpg")),
]);
const backdrop = `data:image/jpeg;base64,${bg.toString("base64")}`;

export const alt = "Haven — Restoring Hope. Protecting Childhood. Building Futures.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const [site, seo] = await Promise.all([getSiteSettings(), getContent("settings.seo")]);
  const [line1, line2] = seo.ogLines;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#061512" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={backdrop} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0 }} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            background: "linear-gradient(90deg, rgba(6,21,18,0.92) 0%, rgba(6,21,18,0.7) 45%, rgba(6,21,18,0.05) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 70px", width: 720 }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <svg width="62" height="60" viewBox="0 0 120 116">
              <path fill="#f0462c" d="M3.5 46.5c0-3.6 2.2-6.1 5-8.2L54 5.2c3.7-2.8 8.3-2.8 12 0l45.5 33.1c2.8 2.1 5 4.6 5 8.2 0 6-6.5 9.4-11.6 5.8L60 19.6 15.1 52.3C10 55.9 3.5 52.5 3.5 46.5z" />
              <rect x="18" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <rect x="82" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <path fill="#f5af08" d="M60 98.5c-12.4-8.3-24-16.6-24-28.2 0-7.3 5.4-12.3 11.7-12.3 5.3 0 9.9 3.1 12.3 7.6 2.4-4.5 7-7.6 12.3-7.6 6.3 0 11.7 5 11.7 12.3 0 11.6-11.6 19.9-24 28.2z" />
            </svg>
            <span style={{ fontFamily: "Nunito", fontSize: 56, color: "#fff", lineHeight: 0.8, letterSpacing: -2 }}>aven</span>
          </div>
          <div style={{ fontFamily: "Anton", fontSize: 84, lineHeight: 0.98, color: "#fff", marginTop: 40, textTransform: "uppercase", display: "flex", flexDirection: "column" }}>
            <span>{line1}</span>
            <span style={{ color: "#f5af08" }}>{line2}</span>
          </div>
          <div style={{ fontFamily: "Nunito", fontSize: 26, color: "rgba(255,255,255,0.85)", marginTop: 28 }}>{site.tagline}</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Anton", data: anton, style: "normal", weight: 400 },
        { name: "Nunito", data: nunito, style: "normal", weight: 800 },
      ],
    },
  );
}
