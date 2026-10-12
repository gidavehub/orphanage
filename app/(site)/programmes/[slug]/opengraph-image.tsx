import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";
import sharp from "sharp";
import { getProgramme } from "@/lib/content/public";
import type { ResolvedMedia } from "@/lib/content/types";

// The share image of a programme page (public-pages §7.4; PLAN §4.1): the programme photo on the
// right, its full title and headline in Anton on vu-cream, and the next step. 1200×630, which
// WhatsApp, Facebook and X all read. Fonts and the fallback backdrop are read once; the photo is
// converted to JPEG with sharp (the media pipeline serves WebP, which the image renderer cannot read).

const [anton, nunito, fallbackBg] = await Promise.all([
  readFile(join(process.cwd(), "assets/fonts/Anton-Regular.ttf")),
  readFile(join(process.cwd(), "assets/fonts/Nunito-ExtraBold.ttf")),
  readFile(join(process.cwd(), "assets/og-bg.jpg")),
]);

export const alt = "A Haven programme";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PUBLIC_DIR = join(process.cwd(), "public");

function srcOf(m: ResolvedMedia | undefined): string {
  if (!m) return "";
  return m.type === "image" ? m.src : m.type === "video" ? m.poster : "";
}

/** A local /media/… photo as a JPEG data URL (cropped for the right-hand panel), or the brand backdrop. */
async function photo(src: string): Promise<string> {
  try {
    if (/^\/media\/[A-Za-z0-9/_.-]+$/.test(src) && !src.includes("..")) {
      const file = normalize(join(PUBLIC_DIR, src));
      if (file.startsWith(PUBLIC_DIR + sep)) {
        const jpg = await sharp(await readFile(file)).resize(620, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 82 }).toBuffer();
        return `data:image/jpeg;base64,${jpg.toString("base64")}`;
      }
    }
  } catch {
    // fall back to the brand backdrop
  }
  return `data:image/jpeg;base64,${fallbackBg.toString("base64")}`;
}

export default async function ProgrammeOgImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const programme = await getProgramme(slug);
  const eyebrow = programme?.fullTitle ?? "Our Programmes";
  const title = programme?.headline ?? "Care That Reaches Every Need";
  const protection = programme?.id === "protection";
  const media = programme ? (programme.image.type === "image" ? programme.image : programme.hero.media) : undefined;
  const img = await photo(srcOf(media));
  const illustrative = !!media && media.type !== "document" && media.illustrative;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f5efe4" }}>
        <div style={{ width: 580, height: 630, display: "flex", flexDirection: "column", padding: "52px 52px 52px 56px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
            <svg width="50" height="48" viewBox="0 0 120 116">
              <path fill="#f0462c" d="M3.5 46.5c0-3.6 2.2-6.1 5-8.2L54 5.2c3.7-2.8 8.3-2.8 12 0l45.5 33.1c2.8 2.1 5 4.6 5 8.2 0 6-6.5 9.4-11.6 5.8L60 19.6 15.1 52.3C10 55.9 3.5 52.5 3.5 46.5z" />
              <rect x="18" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <rect x="82" y="45" width="20" height="68" rx="10" fill="#1f715a" />
              <path fill="#f5af08" d="M60 98.5c-12.4-8.3-24-16.6-24-28.2 0-7.3 5.4-12.3 11.7-12.3 5.3 0 9.9 3.1 12.3 7.6 2.4-4.5 7-7.6 12.3-7.6 6.3 0 11.7 5 11.7 12.3 0 11.6-11.6 19.9-24 28.2z" />
            </svg>
            <span style={{ fontFamily: "Nunito", fontSize: 44, color: "#1d1d1b", lineHeight: 0.8, letterSpacing: -2 }}>aven</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 46 }}>
            <div style={{ display: "flex", fontFamily: "Nunito", fontSize: 21, color: "#1f715a", textTransform: "uppercase", letterSpacing: 2 }}>{eyebrow}</div>
            <div
              style={{
                display: "flex",
                fontFamily: "Anton",
                fontSize: title.length > 34 ? 56 : title.length > 24 ? 64 : 72,
                lineHeight: 1.02,
                color: "#1d1d1b",
                textTransform: "uppercase",
                marginTop: 14,
                width: 472,
              }}
            >
              {title}
            </div>
          </div>
          <div style={{ display: "flex", marginTop: "auto", gap: 14 }}>
            <div style={{ display: "flex", background: protection ? "#c03a24" : "#1f715a", color: "#fff", fontFamily: "Nunito", fontSize: 23, padding: "12px 26px", borderRadius: 40 }}>
              {protection ? "Report a concern" : "Request support"}
            </div>
            <div style={{ display: "flex", border: "2px solid #1d1d1b", color: "#1d1d1b", fontFamily: "Nunito", fontSize: 23, padding: "10px 24px", borderRadius: 40 }}>
              Give
            </div>
          </div>
        </div>
        <div style={{ width: 620, height: 630, display: "flex", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" width={620} height={630} style={{ width: 620, height: 630, objectFit: "cover", borderTopLeftRadius: 60 }} />
          <div style={{ position: "absolute", left: 0, top: 0, width: 14, height: 630, display: "flex", background: "#f5af08" }} />
          {illustrative ? (
            <div style={{ position: "absolute", left: 32, bottom: 28, display: "flex", background: "rgba(6,21,18,0.72)", color: "#fff", fontFamily: "Nunito", fontSize: 18, padding: "8px 16px", borderRadius: 30 }}>
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
