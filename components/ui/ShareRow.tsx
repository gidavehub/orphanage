"use client";

import { useEffect, useState } from "react";
import { Check, Link2, Mail, Share2 } from "lucide-react";
import { SocialIcon } from "@/components/art/SocialIcons";
import { useToast } from "./Toast";
import { cn } from "@/lib/cn";

export type ShareRowProps = {
  /** The page to share; a path ("/donate/education") is made absolute from the current origin. */
  url: string;
  title: string;
  text?: string;
  /** Visible label before the buttons. */
  label?: string;
  className?: string;
};

type Channel = "whatsapp" | "facebook" | "x" | "linkedin" | "email";

/** Adds utm_source=share&utm_medium=<channel> (public-pages §2.2). */
function tagged(url: string, medium: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "share");
    u.searchParams.set("utm_medium", medium);
    return u.toString();
  } catch {
    return url;
  }
}

function shareHref(channel: Channel, url: string, title: string, text?: string) {
  const link = encodeURIComponent(tagged(url, channel));
  const t = encodeURIComponent(title);
  switch (channel) {
    case "whatsapp":
      return `https://wa.me/?text=${encodeURIComponent(`${title} ${tagged(url, channel)}`)}`;
    case "facebook":
      return `https://www.facebook.com/sharer/sharer.php?u=${link}`;
    case "x":
      return `https://x.com/intent/post?text=${t}&url=${link}`;
    case "linkedin":
      return `https://www.linkedin.com/sharing/share-offsite/?url=${link}`;
    case "email":
      return `mailto:?subject=${t}&body=${encodeURIComponent(`${text ? `${text}\n\n` : ""}${tagged(url, channel)}`)}`;
  }
}

const CHANNELS: Array<{ id: Channel; label: string }> = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "Email" },
];

const disc =
  "grid size-[46px] place-items-center rounded-full border border-line text-ink transition-all duration-300 hover:-translate-y-0.5 hover:border-forest hover:bg-forest hover:text-white";

/**
 * Share a page (design-system §3.6): the native share sheet first when the device has one, then
 * WhatsApp, Facebook, X, LinkedIn and Email discs, and a "Copy link" pill that confirms with a toast.
 */
export function ShareRow({ url, title, text, label = "Share", className }: ShareRowProps) {
  const [abs, setAbs] = useState(url);
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast, available } = useToast();

  useEffect(() => {
    // Resolve against the current origin and detect navigator.share after hydration (no mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only facts once
    setAbs(new URL(url, window.location.origin).toString());
    setCanShare(typeof navigator.share === "function");
  }, [url]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    const link = tagged(abs, "copy");
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (available) toast({ title: "Link copied", tone: "success" });
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {label ? <p className="mr-1 text-[15px] font-bold text-ink">{label}</p> : null}
      <ul className="flex flex-wrap items-center gap-2.5">
        {canShare ? (
          <li>
            <button
              type="button"
              onClick={() => navigator.share({ title, text, url: tagged(abs, "native") }).catch(() => {})}
              className="inline-flex h-[46px] items-center gap-2 rounded-full bg-forest px-5 text-[14px] font-bold text-white transition-colors duration-300 hover:bg-marigold hover:text-night"
            >
              <Share2 aria-hidden className="size-4" strokeWidth={2.5} />
              Share…
            </button>
          </li>
        ) : null}
        {CHANNELS.map((c) => (
          <li key={c.id}>
            <a
              href={shareHref(c.id, abs, title, text)}
              target={c.id === "email" ? undefined : "_blank"}
              rel={c.id === "email" ? undefined : "noopener noreferrer"}
              aria-label={`Share on ${c.label}${c.id === "email" ? "" : " (opens in a new tab)"}`}
              className={disc}
            >
              {c.id === "email" ? <Mail aria-hidden className="size-[18px]" strokeWidth={2} /> : <SocialIcon name={c.id} className="size-[18px]" />}
            </a>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-[46px] items-center gap-2 rounded-full border border-line px-5 text-[14px] font-bold text-ink transition-colors duration-300 hover:border-forest hover:bg-forest hover:text-white"
          >
            {copied ? <Check aria-hidden className="size-4" strokeWidth={3} /> : <Link2 aria-hidden className="size-4" strokeWidth={2.5} />}
            {copied ? "Copied" : "Copy link"}
          </button>
        </li>
      </ul>
      <span className="sr-only" aria-live="polite">
        {copied && !available ? "Link copied" : ""}
      </span>
    </div>
  );
}
