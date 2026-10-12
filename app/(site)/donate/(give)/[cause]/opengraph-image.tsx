import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import sharp from "sharp";
import { getCause } from "@/lib/content/public";
import { money } from "@/lib/money";

// The share image of one cause (public-pages §4.3): its photo, the title in Anton, and the
// raised-of-goal bar when the figures may be shown. WhatsApp, Facebook and X all read 1200×630.
// Fonts and the fallback backdrop are read once at module scope; the photo is converted to JPEG
// with sharp (the media pipeline serves WebP, which the image renderer does not read).

const [anton, nunito, fallbackBg] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Nunito-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/og-bg.jpg")),
]);

export const alt = "Give to a Haven cause";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PUBLIC_DIR = join(process.cwd(), "public");

/** A local /media/… photo as a JPEG data URL (cropped to the right-hand panel), or the brand backdrop. */
async function photo(src: string): Promise<string> {
  try {
    if (/^\/media\/[A-Za-z0-9/_.-]+$/.test(src) && !src.includes("..")) {
      const file = normalize(join(PUBLIC_DIR, src));
      if (file.startsWith(PUBLIC_DIR + sep)) {
        const jpg = await sharp(await readFile(file)).resize(640, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
        return `data:image/jpeg;base64,${jpg.toString("base64")}`;
      }
    }
  } catch {
    // fall back to the brand backdrop
  }
  return `data:image/jpeg;base64,${fallbackBg.toString("base64")}`;
}

export default async function CauseOgImage({ params }: { params: Promise<{ cause: string }> }) {
  const { cause: slug } = await params;
  const cause = await getCause(decodeURIComponent(slug));
  const title = cause?.title ?? "Give Hope, Create Opportunity";
  const eyebrow = cause ? (cause.kind === "programme" ? "Programme" : cause.kind === "general" ? "Where it's needed most" : cause.season) : "Donate";
  const pct = cause && cause.showFigures && cause.goal > 0 ? Math.min(100, (cause.raised / cause.goal) * 100) : null;
  const img = await photo(cause?.image.src ?? "");

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f5efe4" }}>
        <div style={{ width: 600, height: 630, display: "flex", flexDirection: "column", padding: "52px 56px 52px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <svg width="50" height="48" viewBox="0 0 120 116">
              <path fill="#f0462c" d="M3.5 46.5c0-3.6 2.2-6.1 5-8.2L54 5.2c3.7-2.8 8.3-2.8 12 0l45.5 33.1c2.8 2.1 5 4.6 5 8.2 0 6-6.5 9.4-11.6 5.8L60 19.6 15.1 52.3C10 55.9 3.5 52.5 3.5 46.5z" />
              <rect x="18" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <rect x="82" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <path fill="#f5af08" d="M60 98.5c-12.4-8.3-24-16.6-24-28.2 0-7.3 5.4-12.3 11.7-12.3 5.3 0 9.9 3.1 12.3 7.6 2.4-4.5 7-7.6 12.3-7.6 6.3 0 11.7 5 11.7 12.3 0 11.6-11.6 19.9-24 28.2z" />
            </svg>
            <span style={{ fontFamily: "Nunito", fontSize: 44, color: "#1d1d1b", lineHeight: 0.8, letterSpacing: -2 }}>aven</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
            <div style={{ fontFamily: "Nunito", fontSize: 22, color: "#c03a24", textTransform: "uppercase", letterSpacing: 2 }}>{eyebrow}</div>
            <div style={{ fontFamily: "Anton", fontSize: title.length > 26 ? 58 : 70, lineHeight: 1.02, color: "#1d1d1b", textTransform: "uppercase", marginTop: 12, width: 488 }}>
              {title}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: "auto" }}>
            {pct !== null && cause ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", height: 36, alignItems: "center", fontFamily: "Nunito", fontSize: 26, color: "#1d1d1b" }}>
                  {`${money(cause.raised, cause.currency)} raised of ${money(cause.goal, cause.currency)}`}
                </div>
                <div style={{ display: "flex", width: 488, height: 12, marginTop: 12, borderRadius: 12, background: "#f9dfdc" }}>
                  <div style={{ display: "flex", width: `${Math.max(3, pct)}%`, height: 12, borderRadius: 12, background: "#c03a24" }} />
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", height: 36, alignItems: "center", fontFamily: "Nunito", fontSize: 26, color: "#1d1d1b" }}>See exactly where your money goes.</div>
            )}
            <div style={{ display: "flex", alignSelf: "flex-start", background: "#f25e44", color: "#fff", fontFamily: "Nunito", fontSize: 24, padding: "12px 28px", borderRadius: 40 }}>
              Donate now
            </div>
          </div>
        </div>
        <div style={{ width: 600, height: 630, display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" width={600} height={630} style={{ width: 600, height: 630, objectFit: "cover", borderTopLeftRadius: 60 }} />
          {cause?.image.illustrative ? (
            <div style={{ position: "absolute", left: 28, bottom: 28, display: "flex", background: "rgba(6,21,18,0.72)", color: "#fff", fontFamily: "Nunito", fontSize: 18, padding: "8px 16px", borderRadius: 30 }}>
              Illustrative image
            </div>
          ) : null}
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
