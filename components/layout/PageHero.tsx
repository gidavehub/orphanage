import Image from "next/image";
import { Brush } from "@/components/art/Brush";
import { toneColor, type SectionTone } from "@/components/art/BrushEdge";
import { HeartCluster } from "@/components/art/Decor";
import { HandDoodle } from "@/components/art/Hands";
import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { AutoVideo } from "@/components/ui/AutoVideo";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageCredit } from "@/components/ui/ImageCredit";
import { RiseWords } from "@/components/ui/RiseWords";
import type { ProgrammeId } from "@/lib/model/enums";
import type { UiImage, UiVideo } from "@/lib/model/ui";
import { cn } from "@/lib/cn";

export type { Crumb };

export type PageHeroMedia = { image: UiImage } | { video: UiVideo; illustrative?: boolean };

export type PageHeroProps = {
  /**
   * `photo` (default): full-bleed image or video, centred white text, glass breadcrumb, torn bottom edge.
   * `programme`: photo, left-aligned, with the programme icon tab, actions and the disclaimer notice.
   * `plain`: paper, left-aligned, no photo (forms, policies, Report a Concern, Contact).
   * `article`: white, centred reading column with meta, then the cover (news, resource detail).
   * `editorial`: the page's one Voices United chapter (vu-cream, giant Anton title, coral-800 accent).
   */
  variant?: "photo" | "programme" | "plain" | "article" | "editorial";
  eyebrow?: string;
  /**
   * A string, or lines (forced breaks). For `editorial`, the parts alternate plain / ACCENT / plain
   * like VuHeading.
   */
  title: string | string[];
  intro?: React.ReactNode;
  /** The trail after Home ("Home" is prepended). The last crumb is the current page. */
  crumbs: Crumb[];
  /** photo and programme: the background. article: the cover. editorial: the optional capsule. */
  media?: PageHeroMedia;
  /** programme variant: the icon in the tab. */
  programme?: ProgrammeId;
  /** Up to two Buttons. */
  actions?: React.ReactNode;
  /** Rendered above the fold, e.g. <Notice tone="emergency" /> or a programme disclaimer. */
  notice?: React.ReactNode;
  /** article: date · category · read time. plain (policies): "Last reviewed …". */
  meta?: React.ReactNode;
  /** The tone of the following section: the photo variants' torn bottom edge is painted in it. */
  next?: SectionTone;
  /** plain variant art on the right from lg. */
  art?: "hearts" | "hands" | "none";
  /** Absolute origin for the BreadcrumbList JSON-LD. */
  baseUrl?: string;
  /** id of the h1 (default "page-title"). */
  id?: string;
  className?: string;
};

function lines(title: string | string[]) {
  return Array.isArray(title) ? title : [title];
}

function RisingTitle({ title, delay = 120 }: { title: string | string[]; delay?: number }) {
  return (
    <>
      {lines(title).map((line, i) => (
        <span key={i} className="block">
          <RiseWords text={line} delay={delay + i * 200} />
        </span>
      ))}
    </>
  );
}

function PhotoMedia({ media }: { media: PageHeroMedia }) {
  if ("image" in media) {
    const img = media.image;
    return (
      <Image
        src={img.src}
        alt={img.decorative ? "" : img.alt}
        fill
        sizes="100vw"
        quality={75}
        loading="eager"
        fetchPriority="high"
        placeholder={img.blurDataURL ? "blur" : "empty"}
        blurDataURL={img.blurDataURL}
        style={img.focal ? { objectPosition: `${img.focal.x}% ${img.focal.y}%` } : undefined}
        className="object-cover"
      />
    );
  }
  return (
    <>
      <Image src={media.video.poster} alt="" fill sizes="100vw" quality={75} loading="eager" fetchPriority="high" className="object-cover" />
      <AutoVideo src={media.video.src} poster={media.video.poster} aria-hidden className="absolute inset-0 size-full object-cover" />
    </>
  );
}

function isIllustrative(media?: PageHeroMedia) {
  if (!media) return false;
  return "image" in media ? !!media.image.illustrative : !!media.illustrative;
}

/**
 * The inner-page banner (design-system §3.1, PLAN D121). Always renders the page's one `<h1>`; words
 * rise with CSS (`hero-rise`), never Reveal, so it is safe above the fold.
 */
export function PageHero({
  variant = "photo",
  eyebrow,
  title,
  intro,
  crumbs,
  media,
  programme,
  actions,
  notice,
  meta,
  next = "paper",
  art = "hearts",
  baseUrl,
  id = "page-title",
  className,
}: PageHeroProps) {
  if (variant === "photo" || variant === "programme") {
    const left = variant === "programme";
    return (
      <header
        data-nav-theme="glass"
        className={cn(
          "relative isolate flex min-h-[max(340px,min(46svh,600px))] items-center overflow-hidden bg-night text-white focus-marigold md:min-h-[max(380px,min(46svh,600px))]",
          left && "md:min-h-[max(440px,min(56svh,680px))]",
          className,
        )}
      >
        {media ? (
          <div aria-hidden={"image" in media && media.image.decorative ? true : undefined} className="absolute inset-0 -z-20 animate-[kenburns_9s_linear_forwards] motion-reduce:animate-none">
            <PhotoMedia media={media} />
          </div>
        ) : (
          <div className="absolute inset-0 -z-20 bg-deep" />
        )}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(6,21,18,0.55)_0%,rgba(6,21,18,0.38)_45%,rgba(6,21,18,0.62)_100%)]" />
        {left ? <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,21,18,0.55)_0%,rgba(6,21,18,0)_70%)]" /> : null}
        <Brush name="drip" color="var(--color-marigold)" rotate={180} className="absolute -right-6 -top-10 hidden w-[120px] opacity-90 md:block" />

        <div className={cn("wrap relative z-[2] flex flex-col pb-20 pt-12 md:pb-24 xl:pt-16", left ? "items-start text-left" : "items-center text-center")}>
          {left && programme ? (
            <div className="relative mb-6 grid size-24 animate-[hero-rise_0.8s_var(--ease-out-expo)_both] place-items-center rounded-full bg-white motion-reduce:animate-none">
              <span aria-hidden className="absolute inset-0 rounded-full border-[7px] border-marigold-100 [clip-path:inset(0_0_50%_0)]" />
              <ProgrammeIcon name={programme} className="size-[50px]" />
            </div>
          ) : null}
          {eyebrow ? (
            <Eyebrow lines={left ? "right" : "both"} className="animate-[hero-rise_0.9s_var(--ease-out-expo)_both] motion-reduce:animate-none">
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h1
            id={id}
            className={cn(
              "max-w-[1000px] text-balance text-[34px] font-extrabold leading-[1.12] tracking-[-0.01em] [text-shadow:0_4px_30px_rgba(0,0,0,0.25)] md:text-[48px] xl:text-[60px]",
              eyebrow && "mt-4",
            )}
          >
            <RisingTitle title={title} />
          </h1>
          {intro ? (
            <div
              className={cn(
                "mt-4 max-w-[640px] animate-[hero-rise_1s_var(--ease-out-expo)_both] text-[16px] leading-relaxed text-white/85 [animation-delay:500ms] motion-reduce:animate-none lg:text-[18px]",
                !left && "mx-auto",
              )}
            >
              {intro}
            </div>
          ) : null}
          {actions ? (
            <div
              className={cn(
                "mt-7 flex animate-[hero-rise_1s_var(--ease-out-expo)_both] flex-wrap gap-3 [animation-delay:650ms] motion-reduce:animate-none md:gap-4",
                !left && "justify-center",
              )}
            >
              {actions}
            </div>
          ) : null}
          {notice ? <div className="mt-7 w-full max-w-[680px] text-left text-ink">{notice}</div> : null}
          <Breadcrumbs items={crumbs} tone="dark" baseUrl={baseUrl} className="mt-8 max-w-full animate-[hero-rise_1s_var(--ease-out-expo)_both] [animation-delay:800ms] motion-reduce:animate-none" />
        </div>

        {isIllustrative(media) ? <ImageCredit position="static" className="absolute bottom-[calc(5vw+0.75rem)] right-4 md:right-6" /> : null}
        {/* Torn bottom edge in the next section's tone (Partners' band, aspect 1400/120). */}
        <Brush name="band" color={toneColor(next)} className="absolute inset-x-0 top-full z-[1] w-full -translate-y-[58%]" style={{ aspectRatio: "1400 / 120" }} />
      </header>
    );
  }

  if (variant === "editorial") {
    const capsule = media && "image" in media ? media.image : null;
    return (
      <header className={cn("relative overflow-hidden bg-vu-cream focus-forest", className)}>
        <div className={cn("wrap grid items-center gap-10 py-14 md:py-20", capsule && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
          <div>
            <Breadcrumbs items={crumbs} baseUrl={baseUrl} />
            {eyebrow ? <p className="mt-6 font-grotesk text-[13px] font-semibold uppercase tracking-[0.08em] text-ink/75">{eyebrow}</p> : null}
            <h1
              id={id}
              className={cn(
                "font-display text-[46px] uppercase leading-[0.98] tracking-[0.005em] text-ink md:text-[72px] xl:text-[88px]",
                eyebrow ? "mt-3" : "mt-6",
              )}
            >
              {lines(title).map((part, i, all) => (
                <span key={i} className={cn("inline-block animate-[hero-rise_1s_var(--ease-out-expo)_both] motion-reduce:animate-none", i % 2 === 1 && "text-coral-800")} style={{ animationDelay: `${120 + i * 120}ms` }}>
                  {part}
                  {i < all.length - 1 ? " " : ""}
                </span>
              ))}
            </h1>
            {intro ? <div className="mt-6 max-w-[600px] font-grotesk text-[16px] leading-relaxed text-ink/75 md:text-[17px]">{intro}</div> : null}
            {meta ? <div className="mt-4 font-grotesk text-[14px] text-body">{meta}</div> : null}
            {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
            {notice ? <div className="mt-8 max-w-[720px]">{notice}</div> : null}
          </div>
          {capsule ? (
            <div className="relative mx-auto hidden aspect-[4/5] w-full max-w-[340px] overflow-hidden rounded-[70px] lg:block">
              <Image src={capsule.src} alt={capsule.decorative ? "" : capsule.alt} fill sizes="340px" loading="eager" className="object-cover" />
              {capsule.illustrative ? <ImageCredit position="static" className="absolute bottom-6 left-1/2 -translate-x-1/2" /> : null}
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  if (variant === "article") {
    const cover = media && "image" in media ? media.image : null;
    return (
      <header className={cn("bg-white focus-forest", className)}>
        <div className="wrap pt-10 md:pt-14">
          <div className="mx-auto max-w-reading text-center">
            <Breadcrumbs items={crumbs} baseUrl={baseUrl} className="flex justify-center" />
            {eyebrow ? (
              <Eyebrow tone="ink" className="mt-8">
                {eyebrow}
              </Eyebrow>
            ) : null}
            <h1 id={id} className={cn("text-balance text-[32px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink md:text-[44px]", eyebrow ? "mt-4" : "mt-8")}>
              <RisingTitle title={title} />
            </h1>
            {intro ? <div className="mx-auto mt-4 max-w-[600px] text-[17px] leading-relaxed text-body">{intro}</div> : null}
            {meta ? <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-grotesk text-[14px] text-body">{meta}</div> : null}
            {actions ? <div className="mt-7 flex flex-wrap justify-center gap-3">{actions}</div> : null}
            {notice ? <div className="mt-7 text-left">{notice}</div> : null}
          </div>
          {cover ? (
            <div className="relative mx-auto mt-10 aspect-[16/9] max-w-[1040px] overflow-hidden rounded-card-lg md:mt-14">
              <Image
                src={cover.src}
                alt={cover.decorative ? "" : cover.alt}
                fill
                sizes="(min-width:1100px) 1040px, 100vw"
                quality={75}
                loading="eager"
                fetchPriority="high"
                style={cover.focal ? { objectPosition: `${cover.focal.x}% ${cover.focal.y}%` } : undefined}
                className="object-cover"
              />
              <Brush name="edge" color="white" className="absolute -right-[2px] top-0 h-full w-auto translate-x-[10%]" style={{ aspectRatio: "458 / 820" }} />
              {cover.illustrative ? <ImageCredit position="bottom-left" /> : null}
            </div>
          ) : null}
        </div>
      </header>
    );
  }

  // plain
  return (
    <header className={cn("paper relative overflow-hidden focus-forest", className)}>
      <div className="wrap relative grid items-center gap-8 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_200px] lg:py-20">
        <div className="min-w-0">
          <Breadcrumbs items={crumbs} baseUrl={baseUrl} />
          {eyebrow ? (
            <Eyebrow tone="ink" lines="right" className="mt-7">
              {eyebrow}
            </Eyebrow>
          ) : null}
          <h1
            id={id}
            className={cn("max-w-[900px] text-balance text-[32px] font-extrabold leading-[1.15] tracking-[-0.01em] text-ink md:text-[44px] xl:text-[52px]", eyebrow ? "mt-4" : "mt-6")}
          >
            <RisingTitle title={title} />
          </h1>
          {intro ? <div className="mt-4 max-w-[680px] text-[17px] leading-relaxed text-body">{intro}</div> : null}
          {meta ? <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-grotesk text-[14px] text-body">{meta}</div> : null}
          {notice ? <div className="mt-6 max-w-[760px]">{notice}</div> : null}
          {actions ? <div className="mt-7 flex flex-wrap gap-3">{actions}</div> : null}
        </div>
        {art !== "none" ? (
          <div aria-hidden className="hidden justify-self-end lg:block">
            {art === "hands" ? <HandDoodle className="w-[170px]" /> : <HeartCluster className="w-[190px] text-mist" />}
          </div>
        ) : null}
      </div>
    </header>
  );
}
