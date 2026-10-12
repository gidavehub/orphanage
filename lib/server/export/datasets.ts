import "server-only";

// Export datasets (PLAN D102). Each names the permission it needs and whether it carries contact
// details (names, emails, phones): those need a fresh sign-in, are logged as sensitive, and are only
// offered to people who may see contacts. Without contact details, names become references.

import type { Donation } from "@/lib/model/domain/giving";
import type { NewsletterSubscriber, PartnershipEnquiry, VolunteerApplication } from "@/lib/model/domain/engagement";
import type { Permission } from "@/lib/model/permissions";
import { fromMinor } from "@/lib/money";
import { getStore } from "@/lib/server/db";
import { C } from "@/lib/server/db/collections";
import type { WithId } from "@/lib/server/db/store";
import type { Cell } from "./csv";

export type Dataset = {
  id: string;
  label: string;
  perm: Permission;
  /** The permission that also allows names and contact details. */
  contactPerm: Permission;
  rows: (opts: { contact: boolean; from: number; to: number }) => Promise<{ header: string[]; rows: Cell[][] }>;
};

async function all<T>(collection: keyof typeof C, field = "createdAt"): Promise<Array<WithId<T>>> {
  const out: Array<WithId<T>> = [];
  let cursor: string | null = null;
  for (let i = 0; i < 100; i++) {
    const page: { items: Array<WithId<T>>; nextCursor: string | null } = await getStore().list<T>(C[collection], { orderBy: { field, dir: "asc" }, limit: 100, cursor });
    out.push(...page.items);
    if (!page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return out;
}

const day = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString().slice(0, 10) : "");
const inRange = (ms: number, o: { from: number; to: number }) => ms >= o.from && ms < o.to;

export const DATASETS: Record<string, Dataset> = {
  donations: {
    id: "donations",
    label: "Gifts",
    perm: "donation.export",
    contactPerm: "donation.contact",
    async rows(o) {
      const items = (await all<Donation>("donations")).filter((d) => inRange(d.createdAt, o) && !(d as { isSample?: boolean }).isSample);
      const header = ["Reference", "Date", "Kind", "Status", "Currency", "Amount", "Frequency", "Method", "Where it goes", ...(o.contact ? ["Donor", "Email", "Phone", "Country"] : ["Donor reference"])];
      const rows = items.map((d) => {
        const cash = d.kind === "cash" ? d.cash : null;
        const money = cash?.amount ?? d.inKind?.estimatedValue ?? null;
        return [
          d.id,
          day(d.receivedAt ?? d.createdAt),
          d.kind === "cash" ? "Money" : "In kind",
          d.status,
          money?.currency ?? "",
          money ? fromMinor(money.amountMinor, money.currency) : "",
          d.frequency,
          cash?.method ?? "",
          (d.allocations ?? []).map((a) => (a.target.type === "general" ? "Where it's needed most" : a.target.type === "programme" ? a.target.programmeId : a.target.causeSlug)).join("; "),
          ...(o.contact ? [d.donor.fullName, d.donor.email, (d.donor as { phone?: string | null }).phone ?? "", d.donor.country] : [d.donorId ?? ""]),
        ] as Cell[];
      });
      return { header, rows };
    },
  },
  volunteers: {
    id: "volunteers",
    label: "Volunteers",
    perm: "volunteer.export",
    contactPerm: "volunteer.read",
    async rows(o) {
      const items = (await all<VolunteerApplication>("volunteerApplications")).filter((v) => inRange(v.createdAt, o) && (!o.contact || v.consentToContact));
      const header = ["Reference", "Applied", "Stage", "Interests", "Country", ...(o.contact ? ["Name", "Email", "Phone"] : [])];
      return { header, rows: items.map((v) => [v.reference ?? v.id, day(v.createdAt), v.status, v.interests.join("; "), v.applicant.country, ...(o.contact ? [v.applicant.fullName, v.applicant.email, v.applicant.phone ?? ""] : [])]) };
    },
  },
  partners: {
    id: "partners",
    label: "Partners",
    perm: "partnership.export",
    contactPerm: "partnership.read",
    async rows(o) {
      const items = (await all<PartnershipEnquiry>("partnershipEnquiries")).filter((p) => inRange(p.createdAt, o) && (!o.contact || p.consentToContact));
      const header = ["Reference", "Asked", "Stage", "Organisation", "Kind", "Country", ...(o.contact ? ["Contact", "Email", "Phone"] : [])];
      return { header, rows: items.map((p) => [p.reference ?? p.id, day(p.createdAt), p.status, p.organisation.name, p.organisation.kind, p.organisation.country, ...(o.contact ? [p.contact.fullName, p.contact.email, p.contact.phone ?? ""] : [])]) };
    },
  },
  newsletter: {
    id: "newsletter",
    label: "Newsletter subscribers",
    perm: "newsletter.export",
    contactPerm: "newsletter.export",
    async rows(o) {
      const items = (await all<NewsletterSubscriber>("newsletterSubscribers")).filter((s) => s.status === "confirmed" && inRange(s.createdAt, o));
      const header = ["Signed up", "Where", ...(o.contact ? ["First name", "Email"] : [])];
      return { header, rows: items.map((s) => [day(s.confirmedAt ?? s.createdAt), s.source, ...(o.contact ? [s.firstName ?? "", s.email ?? ""] : [])]) };
    },
  },
};
