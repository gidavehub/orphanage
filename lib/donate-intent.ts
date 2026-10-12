import type { Currency } from "@/lib/model/enums";

// An appeal card's "Donate Now" preselects that cause and its currency in the landing donate card
// (public-pages §4.10, content-model §4.8). A window event keeps the two sections decoupled (they are
// siblings on the home page). The card then also offers "See exactly where it goes" for the cause.

export type DonateIntent = { causeSlug: string; currency: Currency };

export const DONATE_EVENT = "haven:donate";

export function requestDonation(detail: DonateIntent) {
  window.dispatchEvent(new CustomEvent<DonateIntent>(DONATE_EVENT, { detail }));
}
