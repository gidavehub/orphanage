import { JsonLd } from "./JsonLd";

/** FAQPage JSON-LD (public-pages §7.2): plain-text questions and answers. */
export function FaqJsonLd({ items }: { items: Array<{ question: string; answer: string }> }) {
  if (!items.length) return null;
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } })),
      }}
    />
  );
}
