"use client";

import Link from "next/link";
import { ArrowRight, Building2, HandHeart, Landmark, MoonStar, Package } from "lucide-react";
import { useDonateContext } from "./DonateStateProvider";

/**
 * Other ways to give (public-pages §4.5.6, `id="other-ways"`): bank transfer and mobile money (the
 * pledge route emails the details for the donor's currency), give in kind (switches the widget), and
 * corporate or partner giving. Zakat-eligible appeals add a Zakat note.
 */
export function OtherWays({
  eyebrow,
  title,
  intro,
  items,
  partnerHref,
  donationsEmail,
  methodsLine,
  zakat,
}: {
  eyebrow?: string;
  title: string[];
  intro?: string;
  items: Array<{ title: string; text?: string }>;
  partnerHref: string;
  donationsEmail: string;
  /** "Wave, Afrimoney, QMoney or bank transfer" for the dalasi; empty when nothing is configured. */
  methodsLine: string;
  zakat?: { title: string; text: string } | null;
}) {
  const ctx = useDonateContext();
  const [bank, kind, partner] = items;

  const giveInKind = () => {
    ctx?.dispatch({ type: "mode", mode: "in_kind" });
    ctx?.dispatch({ type: "focus" });
  };

  return (
    <section id="other-ways" aria-labelledby="other-ways-title" className="scroll-mt-28">
      {eyebrow ? <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{eyebrow}</p> : null}
      <h2 id="other-ways-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[34px]">
        {title.map((l, i) => (
          <span key={i} className="block">
            {l}
          </span>
        ))}
      </h2>
      {intro ? <p className="mt-3 max-w-[560px] text-[16px] leading-relaxed text-body">{intro}</p> : null}

      <ul className="mt-7 grid gap-3">
        <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-card border border-line bg-white p-5 sm:p-6">
          <span aria-hidden className="row-span-4 grid size-11 place-items-center rounded-full bg-marigold-100 text-umber">
            <Landmark className="size-5" />
          </span>
          <span className="col-start-2 text-[17px] font-bold leading-snug text-ink">{bank?.title ?? "Bank transfer or mobile money"}</span>
          <span className="col-start-2 text-[15px] leading-relaxed text-body">{bank?.text}</span>
          <span className="col-start-2 mt-1 font-grotesk text-[13.5px] leading-snug text-body">
            {methodsLine ? (
              <>Methods: {methodsLine}.</>
            ) : (
              <>
                Email{" "}
                <a href={`mailto:${donationsEmail}`} className="font-semibold text-forest underline underline-offset-2">
                  {donationsEmail}
                </a>{" "}
                and we&rsquo;ll send account details.
              </>
            )}
          </span>
        </li>
        <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-card border border-line bg-white p-5 sm:p-6">
          <span aria-hidden className="row-span-4 grid size-11 place-items-center rounded-full bg-mint text-forest">
            <Package className="size-5" />
          </span>
          <span className="col-start-2 text-[17px] font-bold leading-snug text-ink">{kind?.title ?? "Give in kind"}</span>
          <span className="col-start-2 text-[15px] leading-relaxed text-body">{kind?.text}</span>
          <button
            type="button"
            onClick={giveInKind}
            className="col-start-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-left text-[15px] font-bold text-forest underline-offset-4 hover:underline"
          >
            <HandHeart aria-hidden className="size-4" /> Offer items in the donation card
          </button>
        </li>
        <li className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-4 gap-y-1 rounded-card border border-line bg-white p-5 sm:p-6">
          <span aria-hidden className="row-span-4 grid size-11 place-items-center rounded-full bg-clay-100 text-clay-700">
            <Building2 className="size-5" />
          </span>
          <span className="col-start-2 text-[17px] font-bold leading-snug text-ink">{partner?.title ?? "Corporate and partner giving"}</span>
          <span className="col-start-2 text-[15px] leading-relaxed text-body">{partner?.text}</span>
          <Link href={partnerHref} className="col-start-2 inline-flex min-h-11 w-fit items-center gap-1.5 text-[15px] font-bold text-forest underline-offset-4 hover:underline">
            Talk to our partnerships team <ArrowRight aria-hidden className="size-4" />
          </Link>
        </li>
      </ul>

      {zakat ? (
        <p className="mt-4 flex items-start gap-3 rounded-card bg-sand p-5 text-[15px] leading-relaxed text-umber">
          <MoonStar aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>
            <strong className="font-bold">{zakat.title}.</strong> {zakat.text}
          </span>
        </p>
      ) : null}
    </section>
  );
}
