import Link from "next/link";
import { ArrowRight, CreditCard, Info, Landmark, Smartphone } from "lucide-react";
import { blocksToPlain } from "@/components/content/Blocks";
import { ShareRow } from "@/components/ui/ShareRow";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import type { ContactView, PageView } from "@/lib/content/types";
import { routes } from "@/lib/routes";
import type { ThanksView } from "@/lib/server/giving/thanks";
import { cn } from "@/lib/cn";
import { CopyValue, HeartBurst, ThanksSubscribe, TrackComplete } from "./ThanksClient";

// /donate/thank-you (public-pages §4.9, PLAN D67, D70). Only the first name, amount, frequency, cause,
// reference and a masked email are shown; the generic variant shows nothing personal at all.

function text(page: PageView, key: string, fallback: string): string {
  const b = page.sections[key]?.body;
  return b?.length ? blocksToPlain(b) : fallback;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-3.5 last:border-0">
      <dt className="font-grotesk text-[13px] font-medium uppercase tracking-[0.06em] text-body">{label}</dt>
      <dd className="min-w-0 text-right text-[16px] font-bold text-ink">{children}</dd>
    </div>
  );
}

export function ThankYouView({ view, page, contact }: { view: ThanksView; page: PageView; contact: ContactView }) {
  const donations = contact.teamEmails.donations;
  const personal = view.variant !== "generic" && "reference" in view && view.reference ? view : null;
  const firstName = view.variant !== "generic" ? (view.firstName ?? "") : "";
  const cause = view.variant !== "generic" ? (view.cause ?? null) : null;
  const shareUrl = cause?.href ?? routes.donate();
  const route = view.variant === "paid" ? "stripe" : view.variant === "pledge" ? "local" : view.variant === "in_kind" ? "in_kind" : view.variant;

  const intro =
    view.variant === "paid"
      ? text(page, "paid", "Your gift is on its way to a child.")
      : view.variant === "processing"
        ? text(page, "processing", "Your payment is being confirmed. We'll email your receipt shortly.")
        : view.variant === "pledge"
          ? text(page, "pledge", "Here is how to complete your gift. Please quote your reference so we can match your payment.")
          : view.variant === "in_kind"
            ? text(page, "inKind", "Our team will contact you to arrange how your items reach us.").replace(
                "drop-off, collection or shipping",
                view.handover === "drop_off" ? "drop-off" : view.handover === "collection" ? "collection" : "shipping",
              )
            : text(page, "generic", page.hero.intro ?? "Thank you for supporting Haven.");

  const nextItems = page.sections.whatNext?.items ?? [];
  const steps: TimelineItem[] = (
    view.variant === "pledge" ? [{ title: "Send your gift", text: "Use the payment details above and quote your reference." }, ...nextItems] : nextItems
  )
    .filter((it) => !(it.title.toLowerCase().includes("impact updates") && view.variant !== "generic" && "updates" in view && !view.updates))
    .map((it, i) => ({
      id: `next-${i}`,
      title: it.title.replace("your cause", cause ? cause.title : "your cause"),
      ...(it.text ? { body: it.text } : {}),
    }));

  const recurring = (view.variant === "paid" || view.variant === "pledge") && view.recurring;
  const wantsUpdates = view.variant === "generic" || view.variant === "processing" || !view.updates;

  return (
    <>
      <TrackComplete route={route} />
      {/* ── The thank-you ── */}
      <section aria-labelledby="page-title" className="relative overflow-hidden bg-vu-cream">
        <span aria-hidden className="pointer-events-none absolute -left-24 top-10 size-72 rounded-full bg-coral/10 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -right-24 bottom-0 size-80 rounded-full bg-marigold/15 blur-3xl" />
        <div className={cn("wrap relative grid items-center gap-12 py-16 md:py-24", personal && "lg:grid-cols-[minmax(0,1fr)_440px]")}>
          <div className={cn(!personal && "mx-auto max-w-[720px] text-center")}>
            <HeartBurst className={cn(!personal && "mx-auto")} />
            <h1 id="page-title" className="mt-8 font-display text-[52px] uppercase leading-[0.95] tracking-[0.005em] text-ink sm:text-[72px] md:text-[88px]">
              <span className="block animate-[hero-rise_1s_var(--ease-out-expo)_both] motion-reduce:animate-none">{page.hero.title[0] ?? "Thank you"}{firstName ? "," : ""}</span>
              {firstName ? (
                <span className="block animate-[hero-rise_1s_var(--ease-out-expo)_0.12s_both] text-coral-800 motion-reduce:animate-none">{firstName}</span>
              ) : null}
            </h1>
            <p className={cn("mt-6 max-w-[560px] font-grotesk text-[17px] leading-relaxed text-ink/80 md:text-[18px]", !personal && "mx-auto")}>{intro}</p>
            {view.variant === "processing" ? (
              <p role="status" className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-grotesk text-[13.5px] font-semibold text-umber shadow-thumb">
                <span aria-hidden className="size-2 animate-pulse rounded-full bg-marigold" /> Confirming with the bank…
              </p>
            ) : null}
          </div>

          {personal ? (
            <div className="rounded-[30px] bg-white p-6 shadow-modal sm:p-8">
              <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.1em] text-body">Your {view.variant === "in_kind" ? "offer" : "gift"}</p>
              <dl className="mt-2">
                {cause ? <Row label="Cause">{cause.title}</Row> : null}
                {(view.variant === "paid" || view.variant === "pledge") ? (
                  <>
                    <Row label="Amount">
                      <span className="font-display text-[24px] font-normal leading-none tracking-[0.01em]">{view.amount}</span>
                    </Row>
                    <Row label="How often">{view.frequencyLabel}</Row>
                  </>
                ) : null}
                {view.variant === "in_kind" ? (
                  <>
                    <Row label="Items">{view.items.join(", ")}</Row>
                    <Row label="Handover">{view.handoverLabel}</Row>
                  </>
                ) : null}
                <Row label="Reference">
                  <span className="flex items-center justify-end gap-2">
                    <span className="whitespace-nowrap font-grotesk tabular-nums">{personal.reference}</span>
                    <CopyValue value={personal.reference ?? ""} label="Reference" />
                  </span>
                </Row>
                {personal.maskedEmail ? (
                  <Row label={view.variant === "paid" ? "Receipt sent to" : "Email sent to"}>
                    <span className="font-grotesk text-[15px] font-semibold">{personal.maskedEmail}</span>
                  </Row>
                ) : null}
              </dl>
            </div>
          ) : null}
        </div>
      </section>

      <div className="paper">
        <div className="wrap grid gap-14 pb-28 pt-16 md:pb-40 md:pt-24 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-16">
          <div className="grid min-w-0 content-start gap-14">
            {/* ── How to pay (pledges) ── */}
            {view.variant === "pledge" ? (
              <section aria-labelledby="pay-title" className="rounded-card-lg bg-white p-6 shadow-soft sm:p-8 md:p-10">
                <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{page.sections.pledge?.eyebrow ?? "How to Pay"}</p>
                <h2 id="pay-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[32px]">
                  {page.sections.pledge?.title?.join(" ") ?? "Complete Your Gift"}
                </h2>
                <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-sand px-5 py-4">
                  <p className="font-grotesk text-[14px] text-umber">
                    Quote this reference: <strong className="ml-1 font-display text-[22px] font-normal tracking-[0.02em] text-ink">{view.reference}</strong>
                  </p>
                  <CopyValue value={view.reference} label="Reference" />
                </div>

                {view.instructions ? (
                  <div className="mt-6 grid gap-4">
                    {view.instructions.bank ? (
                      <div className="rounded-[22px] border border-line p-5">
                        <p className="flex items-center gap-2.5 text-[17px] font-bold text-ink">
                          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-marigold-100 text-umber">
                            <Landmark className="size-4" />
                          </span>
                          Bank transfer ({view.currency})
                        </p>
                        <dl className="mt-3">
                          {view.instructions.bank.rows.map((r) => (
                            <div key={r.label} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-line py-2.5 last:border-0">
                              <dt className="font-grotesk text-[13px] text-body">{r.label}</dt>
                              <dd className="flex items-center gap-2 font-grotesk text-[15px] font-semibold tabular-nums text-ink">
                                {r.value}
                                {r.copy ? <CopyValue value={r.value} label={r.label} /> : null}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    ) : null}
                    {view.instructions.mobileMoney.map((m) => (
                      <div key={`${m.provider}-${m.number}`} className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-line p-5">
                        <p className="flex items-center gap-2.5">
                          <span aria-hidden className="grid size-9 place-items-center rounded-full bg-mint text-forest">
                            <Smartphone className="size-4" />
                          </span>
                          <span>
                            <span className="block text-[17px] font-bold text-ink">{m.providerLabel}</span>
                            <span className="block font-grotesk text-[13px] text-body">{m.name}</span>
                          </span>
                        </p>
                        <span className="flex items-center gap-2 font-grotesk text-[16px] font-semibold tabular-nums text-ink">
                          {m.number}
                          <CopyValue value={m.number} label={`${m.providerLabel} number`} />
                        </span>
                      </div>
                    ))}
                    {view.instructions.note ? <p className="text-[15px] leading-relaxed text-body">{view.instructions.note}</p> : null}
                  </div>
                ) : (
                  <p className="mt-6 flex items-start gap-3 rounded-[22px] bg-cream px-5 py-4 text-[15.5px] leading-relaxed text-umber">
                    <Info aria-hidden className="mt-1 size-4 shrink-0" />
                    <span>
                      {text(page, "pledgeNoInstructions", "Our team will email you payment details within 2 working days.")}
                      {view.method ? <> You chose: <strong>{view.method.label}</strong>.</> : null}
                    </span>
                  </p>
                )}

                {view.cardAlternative ? (
                  <p className="mt-6 flex flex-wrap items-center gap-2 text-[15px] text-body">
                    <CreditCard aria-hidden className="size-4 text-forest" /> Prefer to pay by card?
                    <Link href={view.cardAlternative.href} className="font-bold text-forest underline underline-offset-4 hover:text-deep">
                      {view.cardAlternative.label}
                    </Link>
                  </p>
                ) : null}
              </section>
            ) : null}

            {/* ── What happens next ── */}
            {steps.length ? (
              <section aria-labelledby="next-title">
                <p className="font-script text-[22px] font-bold leading-none text-marigold-ink md:text-[24px]">{page.sections.whatNext?.eyebrow ?? "What Happens Next"}</p>
                <h2 id="next-title" className="mt-2 text-[28px] font-extrabold leading-tight text-ink md:text-[32px]">
                  From your {view.variant === "in_kind" ? "offer" : "gift"} to a child
                </h2>
                <Timeline className="mt-8" items={steps} headingLevel={3} />
              </section>
            ) : null}

            {recurring ? (
              <p className="flex items-start gap-3 rounded-card bg-white p-5 text-[15.5px] leading-relaxed text-body shadow-soft">
                <Info aria-hidden className="mt-1 size-4 shrink-0 text-forest" />
                <span>
                  {view.variant === "paid" ? (
                    <>
                      {text(page, "recurring", "To change or cancel your gift at any time, use the secure link in your receipt email.")}{" "}
                      <Link href={routes.manage()} className="font-bold text-forest underline underline-offset-4">
                        Manage my gift
                      </Link>
                    </>
                  ) : (
                    <>
                      {text(page, "recurringPledge", "To change or cancel your regular gift, reply to your email or write to our donations team.")}{" "}
                      <a href={`mailto:${donations}`} className="font-bold text-forest underline underline-offset-4">
                        {donations}
                      </a>
                    </>
                  )}
                </span>
              </p>
            ) : null}
          </div>

          <aside className="grid min-w-0 content-start gap-8">
            <section aria-labelledby="share-title" className="rounded-card-lg bg-white p-6 shadow-soft sm:p-8">
              <h2 id="share-title" className="text-[24px] font-extrabold leading-tight text-ink">
                {page.sections.share?.title?.join(" ") ?? "Ask a Friend to Stand With You"}
              </h2>
              <p className="mt-2 text-[15px] leading-relaxed text-body">{text(page, "share", "Share the cause you chose.")}</p>
              <ShareRow className="mt-5" url={shareUrl} title={cause ? cause.title : "Give to Haven"} label="" />
            </section>
            {wantsUpdates ? (
              <ThanksSubscribe eyebrow={page.sections.updates?.eyebrow} title={page.sections.updates?.title?.join(" ") ?? "Hear What Your Gift Changed"} text={text(page, "updates", "")} />
            ) : null}
            <nav aria-label="Keep exploring" className="grid gap-2">
              {[
                { href: routes.stories(), label: "Stories of Hope" },
                { href: routes.impact(), label: "Our Impact" },
                { href: routes.home, label: "Home" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="group flex min-h-12 items-center justify-between rounded-full bg-white px-6 text-[16px] font-bold text-ink shadow-[0_12px_30px_-26px_rgba(74,44,26,0.5)] transition-colors duration-300 hover:bg-forest hover:text-white"
                >
                  {l.label}
                  <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      </div>
    </>
  );
}
