import "server-only";

import type { GiveColumnData } from "@/components/donate/GiveColumn";
import {
  getCause,
  getCauses,
  getContact,
  getFaqs,
  getHomeContent,
  getPage,
  getPaymentSettings,
  getResources,
  getSiteSettings,
} from "@/lib/content/public";
import type { CauseView } from "@/lib/content/types";
import { CURRENCIES, type Currency } from "@/lib/model/enums";
import { CURRENCY_NAME, LOCAL_PAYMENT_METHOD_LABEL } from "@/lib/model/labels";
import { routes } from "@/lib/routes";
import { toWidgetCause } from "@/lib/server/giving/pledge";

// Data for the donate page's left column (public-pages §4.3, §4.5). Every read is a cached content
// or settings reader, so /donate and every prerendered /donate/[cause] stay static.

function eyebrowOf(c: CauseView, generalEyebrow: string): string {
  if (c.kind === "general") return generalEyebrow;
  if (c.eyebrow) return c.eyebrow;
  switch (c.kind) {
    case "programme":
      return "Programme";
    case "sponsorship":
      return "Sponsorship";
    case "project":
      return "Project";
    default:
      return `Seasonal appeal · ${c.season}`;
  }
}

/** "Wave, Afrimoney, QMoney, Bank transfer (dalasi)" for currencies whose details are configured. */
async function methodsLine(): Promise<string> {
  const s = await getPaymentSettings();
  const parts: string[] = [];
  for (const c of CURRENCIES as readonly Currency[]) {
    const i = s.instructions[c];
    if (!i) continue;
    const hasDetails = Boolean(i.bank?.accountNumber?.trim()) || i.mobileMoney.some((m) => m.number?.trim());
    if (!hasDetails) continue;
    const names = i.methods.filter((m) => m !== "card_link").map((m) => LOCAL_PAYMENT_METHOD_LABEL[m]);
    if (names.length) parts.push(`${names.join(", ")} (${CURRENCY_NAME[c].toLowerCase()})`);
  }
  return parts.join("; ");
}

/** The left column's data for a cause slug ("general" is /donate), or null for an unknown cause. */
export async function loadGiveColumn(slug: string): Promise<GiveColumnData | null> {
  const general = slug === "general";
  const [view, page, home, faqs, site, contact, line, reports, all] = await Promise.all([
    getCause(slug),
    getPage("donate"),
    getHomeContent(),
    getFaqs({ placement: "donate" }),
    getSiteSettings(),
    getContact(),
    methodsLine(),
    getResources({ category: "annual_reports" }),
    general ? getCauses({ liveOnly: true }) : Promise.resolve([] as CauseView[]),
  ]);
  if (!view) return null;
  const report = reports.items[0];
  return {
    general,
    cause: toWidgetCause(view),
    title: view.title,
    summary: view.summary,
    eyebrow: eyebrowOf(view, page.hero.eyebrow ?? "Where it’s needed most"),
    story: view.story,
    ...(view.showFigures ? { otherTotals: view.otherCurrencyTotals } : {}),
    page,
    causes: all.map(toWidgetCause),
    groups: home.appeals.section.groups,
    steps: home.journey.steps.map((st) => ({ id: st.id, title: st.title, text: st.text, image: st.image })),
    faqs: faqs.map((f) => ({ id: f.id, q: f.q, a: f.a })),
    registrations: site.registrations,
    everyChild: site.everyChild,
    donationsEmail: contact.teamEmails.donations,
    methodsLine: line,
    report: report
      ? { href: routes.resource(report.slug), label: `Read the ${/^annual/i.test(report.title) ? report.title.charAt(0).toLowerCase() + report.title.slice(1) : report.title}` }
      : { href: routes.resources({ category: "annual_reports" }), label: "Annual reports" },
  };
}
