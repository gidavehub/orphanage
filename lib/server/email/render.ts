import "server-only";

// One-column brand email (integrations §4.5, PLAN D118): a 600px table layout with inline styles,
// design-system hex values (paper #f4f1ec, forest #1f715a, deep #14332b, ink #1d1d1b, marigold
// #f5af08 with night #061512 text, emergency notices coral-800 #c03a24 on coral-100 #fdebe6), plus
// a plain-text part from the same blocks. Text is always escaped; `**bold**` is the only markup.
// Buttons link only to our own origin, Zoom or Stripe; anything else is shown as text.

import { baseUrl } from "@/lib/server/url";
import { log } from "@/lib/server/log";
import { escapeHtml } from "@/lib/server/security/sanitise";
import type { EmailBlock, EmailDoc } from "./types";

export type RenderOptions = {
  /** Absolute origin for links; defaults to baseUrl(). */
  baseUrl?: string;
  /** Redirect mode: "Test copy. Originally to: a***@gmail.com (support_confirmation)". */
  testNotice?: string | null;
  /** "updates" footer: the unsubscribe link. */
  unsubscribeUrl?: string | null;
  /** Organisation line in the footer (name, address, registration) when known. */
  orgLine?: string | null;
};

const COLOR = {
  paper: "#f4f1ec",
  white: "#ffffff",
  cream: "#fcf9ea",
  card: "#f9f6ed",
  forest: "#1f715a",
  deep: "#14332b",
  ink: "#1d1d1b",
  body: "#5c5b58",
  line: "#e7e3da",
  marigold: "#f5af08",
  night: "#061512",
  coral800: "#c03a24",
  coral700: "#e14f36",
  coral100: "#fdebe6",
  sand: "#f3e7d3",
  umber: "#4a2c1a",
} as const;

const FONT = "'Nunito','Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const ALLOWED_HOSTS = [/^(?:[a-z0-9-]+\.)*zoom\.us$/i, /^checkout\.stripe\.com$/i, /^billing\.stripe\.com$/i];

/** Escaped text with **bold** turned into <strong>. */
function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700;color:' + COLOR.deep + '">$1</strong>');
}

function plain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

/** An absolute, allowed link target, or null. Site-relative paths are made absolute. */
function safeHref(href: string, base: string): string | null {
  try {
    const url = href.startsWith("/") && !href.startsWith("//") ? new URL(href, `${base}/`) : new URL(href);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const own = new URL(base);
    if (url.origin === own.origin) return url.toString();
    if (url.protocol === "https:" && ALLOWED_HOSTS.some((re) => re.test(url.hostname))) return url.toString();
    return null;
  } catch {
    return null;
  }
}

function blockHtml(b: EmailBlock, base: string): string {
  switch (b.type) {
    case "p":
      return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.ink}">${inline(b.text)}</p>`;
    case "button": {
      const href = safeHref(b.href, base);
      if (!href) {
        log.warn("email.render.unsafe_link_dropped", { label: b.label });
        return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.ink}">${escapeHtml(b.label)}</p>`;
      }
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px"><tr><td style="border-radius:999px;background:${COLOR.marigold}"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:800;line-height:20px;color:${COLOR.night};text-decoration:none;border-radius:999px">${escapeHtml(b.label)}</a></td></tr></table>`;
    }
    case "details": {
      const rows = b.rows
        .map(
          ([label, value]) =>
            `<tr><td style="padding:8px 12px;font-family:${FONT};font-size:14px;line-height:20px;color:${COLOR.body};white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:8px 12px;font-family:${FONT};font-size:15px;line-height:22px;color:${COLOR.ink};font-weight:700">${escapeHtml(value)}</td></tr>`,
        )
        .join("");
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px;background:${COLOR.card};border-radius:12px">${rows}</table>`;
    }
    case "notice": {
      const style =
        b.tone === "emergency"
          ? `background:${COLOR.coral100};border-left:4px solid ${COLOR.coral700};color:${COLOR.coral800}`
          : b.tone === "test"
            ? `background:${COLOR.sand};border-left:4px solid ${COLOR.umber};color:${COLOR.umber}`
            : `background:${COLOR.card};border-left:4px solid ${COLOR.forest};color:${COLOR.deep}`;
      return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 20px"><tr><td style="${style};padding:14px 16px;border-radius:8px;font-family:${FONT};font-size:15px;line-height:23px">${inline(b.text)}</td></tr></table>`;
    }
    case "list":
      return `<ul style="margin:0 0 16px;padding-left:22px;font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.ink}">${b.items.map((i) => `<li style="margin:0 0 6px">${inline(i)}</li>`).join("")}</ul>`;
    case "divider":
      return `<hr style="border:0;border-top:1px solid ${COLOR.line};margin:24px 0">`;
  }
}

function blockText(b: EmailBlock, base: string): string {
  switch (b.type) {
    case "p":
      return plain(b.text);
    case "button": {
      const href = safeHref(b.href, base);
      return href ? `${b.label}: ${href}` : b.label;
    }
    case "details":
      return b.rows.map(([l, v]) => `${l}: ${v}`).join("\n");
    case "notice":
      return plain(b.text);
    case "list":
      return b.items.map((i) => `- ${plain(i)}`).join("\n");
    case "divider":
      return "---";
  }
}

function footerParts(doc: EmailDoc, opts: RenderOptions, base: string): { html: string; text: string } {
  const why =
    doc.footer === "staff"
      ? "You're receiving this because you're a member of the Haven team."
      : doc.footer === "updates"
        ? "You're receiving this because you asked for updates from Haven."
        : "You're receiving this because you contacted Haven or gave to Haven.";
  const privacy = `${base}/policies/privacy`;
  const lines = [opts.orgLine ?? "Haven · Protecting and supporting children and families", why];
  const unsubscribe = doc.footer === "updates" && opts.unsubscribeUrl ? safeHref(opts.unsubscribeUrl, base) : null;
  const html =
    `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.body}">${lines.map(escapeHtml).join("<br>")}</p>` +
    `<p style="margin:0;font-family:${FONT};font-size:12px;line-height:18px;color:${COLOR.body}"><a href="${escapeHtml(privacy)}" style="color:${COLOR.forest}">How we use your information</a>` +
    (unsubscribe ? ` · <a href="${escapeHtml(unsubscribe)}" style="color:${COLOR.forest}">Unsubscribe</a>` : "") +
    `</p>`;
  const text = [...lines, `How we use your information: ${privacy}`, ...(unsubscribe ? [`Unsubscribe: ${unsubscribe}`] : [])].join("\n");
  return { html, text };
}

/** Renders an EmailDoc to brand HTML and a plain-text part. */
export function renderEmail(doc: EmailDoc, opts: RenderOptions = {}): { html: string; text: string } {
  const base = (opts.baseUrl ?? baseUrl()).replace(/\/+$/, "");
  const blocks = opts.testNotice ? [{ type: "notice", tone: "test", text: opts.testNotice } as EmailBlock, ...doc.blocks] : doc.blocks;
  const footer = footerParts(doc, opts, base);

  const body =
    (doc.greeting ? `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:26px;color:${COLOR.ink}">${inline(doc.greeting)}</p>` : "") +
    blocks.map((b) => blockHtml(b, base)).join("") +
    (doc.signOff
      ? `<p style="margin:24px 0 0;font-family:'Caveat','Segoe Script','Bradley Hand',cursive;font-size:22px;line-height:28px;color:${COLOR.forest}">${escapeHtml(doc.signOff)}</p>`
      : "");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(doc.heading)}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.haven-pad{padding:24px 20px !important}.haven-card{border-radius:0 !important}}</style>
</head>
<body style="margin:0;padding:0;background:${COLOR.paper}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${COLOR.paper}">${escapeHtml(doc.preheader)}</div>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLOR.paper}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" class="haven-card" cellpadding="0" cellspacing="0" border="0" width="600" style="width:100%;max-width:600px;background:${COLOR.white};border-top:6px solid ${COLOR.forest};border-radius:16px;overflow:hidden">
<tr><td style="background:${COLOR.cream};padding:22px 32px" class="haven-pad"><span style="font-family:${FONT};font-size:26px;font-weight:800;letter-spacing:-0.5px;color:${COLOR.forest}">Haven</span></td></tr>
<tr><td class="haven-pad" style="padding:32px">
<h1 style="margin:0 0 20px;font-family:${FONT};font-size:26px;line-height:32px;font-weight:800;color:${COLOR.deep}">${escapeHtml(doc.heading)}</h1>
${body}
</td></tr>
<tr><td class="haven-pad" style="padding:20px 32px 28px;border-top:1px solid ${COLOR.line}">${footer.html}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    doc.heading,
    "",
    ...(doc.greeting ? [plain(doc.greeting), ""] : []),
    ...blocks.flatMap((b) => [blockText(b, base), ""]),
    ...(doc.signOff ? [doc.signOff, ""] : []),
    "--",
    footer.text,
  ].join("\n");

  return { html, text };
}
