import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { Accordion } from "@/components/ui/Accordion";
import { inlineToPlain, renderInline } from "@/lib/content/inline";
import type { FaqView } from "@/lib/content/types";

/** An FAQ answer: InlineText, so its links stay links (internal ones through next/link). */
export function FaqAnswer({ text }: { text: string }) {
  return (
    <p>
      {renderInline(text, {
        internalLink: ({ href, className, children }) => (
          <Link href={href} className={className}>
            {children}
          </Link>
        ),
      })}
    </p>
  );
}

/** FAQPage structured data for the questions shown (public-pages §7.2). */
export function FaqJsonLdBlock({ faqs }: { faqs: FaqView[] }) {
  if (!faqs.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: inlineToPlain(f.a) } })),
      }}
    />
  );
}

/**
 * A list of questions as the landing's card accordion (D120: FaqAccordion → Accordion card), the
 * first one open, with its FAQPage JSON-LD. Used by the programme pages (their `faqIds`).
 */
export function FaqList({ faqs, headingLevel = 3, className }: { faqs: FaqView[]; headingLevel?: 2 | 3 | 4; className?: string }) {
  if (!faqs.length) return null;
  return (
    <>
      <Accordion
        className={className}
        headingLevel={headingLevel}
        defaultOpen={faqs[0] ? [faqs[0].id] : []}
        items={faqs.map((f) => ({ id: f.id, title: f.q, content: <FaqAnswer text={f.a} /> }))}
      />
      <FaqJsonLdBlock faqs={faqs} />
    </>
  );
}
