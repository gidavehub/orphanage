import "server-only";

// One Stripe Product per cause with a deterministic id (integrations §3.3), so the Dashboard stays
// clean: price_data.product_data would create a new Product on every gift. Memoised per process; a
// concurrent create racing on the same id retrieves the winner.

import type Stripe from "stripe";

const made = new Map<string, Promise<string>>();

export function productIdFor(causeSlug: string): string {
  return `haven_cause_${causeSlug.replace(/[^a-z0-9_-]/g, "_")}`.slice(0, 60);
}

function isStripeError(e: unknown): e is { statusCode?: number; code?: string } {
  return typeof e === "object" && e !== null && ("statusCode" in e || "code" in e);
}

async function ensure(stripe: Stripe, cause: { slug: string; title: string }): Promise<string> {
  const id = productIdFor(cause.slug);
  try {
    return (await stripe.products.retrieve(id)).id;
  } catch (e) {
    if (!isStripeError(e) || e.statusCode !== 404) throw e;
  }
  try {
    return (await stripe.products.create({ id, name: `Gift to Haven: ${cause.title}`.slice(0, 250), metadata: { haven_cause: cause.slug } })).id;
  } catch (e) {
    if (isStripeError(e) && e.code === "resource_already_exists") return (await stripe.products.retrieve(id)).id;
    throw e;
  }
}

/** The cause's Product id, creating it the first time. */
export function ensureCauseProduct(stripe: Stripe, cause: { slug: string; title: string }): Promise<string> {
  const key = productIdFor(cause.slug);
  const hit = made.get(key);
  if (hit) return hit;
  const p = ensure(stripe, cause).catch((e) => {
    made.delete(key);
    throw e;
  });
  made.set(key, p);
  return p;
}
