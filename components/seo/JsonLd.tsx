/** A JSON-LD value: schema.org objects as plain JSON. */
export type JsonLdData = { [key: string]: unknown } | Array<{ [key: string]: unknown }>;

/**
 * Structured data as `<script type="application/ld+json">` (Next docs: guides/json-ld).
 * `<` is escaped to `<` so no string inside the data can close the script tag. This is one of
 * the two places allowed to use dangerouslySetInnerHTML (PLAN §7.5).
 */
export function JsonLd({ data, id }: { data: JsonLdData; id?: string }) {
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
