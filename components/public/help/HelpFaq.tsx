import Link from "next/link";
import { JsonLd } from "@/components/seo/JsonLd";
import { Accordion } from "@/components/ui/Accordion";
import type { FaqView } from "@/lib/content/public";
import { inlineToPlain, renderInline } from "@/lib/content/inline";

/**
 * A FAQ group as the landing's card accordion (public-pages §3.5.6, §3.8.5), with FAQPage
 * structured data. Answers are InlineText, so links in them stay links.
 */
export function HelpFaq({ faqs, className }: { faqs: FaqView[]; className?: string }) {
  if (!faqs.length) return null;
  return (
    <>
      <Accordion
        className={className}
        defaultOpen={faqs[0] ? [faqs[0].id] : []}
        items={faqs.map((f) => ({
          id: f.id,
          title: f.q,
          content: (
            <p>
              {renderInline(f.a, {
                internalLink: ({ href, className: cls, children }) => (
                  <Link href={href} className={cls}>
                    {children}
                  </Link>
                ),
              })}
            </p>
          ),
        }))}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: inlineToPlain(f.a) } })),
        }}
      />
    </>
  );
}
