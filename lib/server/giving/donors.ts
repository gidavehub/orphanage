import "server-only";

// Donor profiles (data-model §4.3, PLAN D65): donors/{emailHash}, upserted inside the same
// transaction that records a gift. The id is HMAC(HAVEN_LOOKUP_SECRET, emailLower), so the address is
// never the key. A pledge refreshes the contact details and the latest recognition and updates
// preference; lifetime totals move only when money is received (A4 / I1), never at pledge time.

import type { Donor, DonorSnapshot } from "@/lib/model/domain/giving";
import type { ConsentStamp, CountryCode, Millis } from "@/lib/model/enums";
import { docPath } from "@/lib/server/db/collections";
import { buildSearchTokens } from "@/lib/server/db/search-tokens";
import type { Tx, WithId } from "@/lib/server/db/store";
import { emailHash } from "@/lib/server/security/hmac";
import type { DonorInput } from "@/lib/server/payments/schemas";

/** donors/{emailHash}. */
export function donorIdOf(email: string): string {
  return emailHash(email);
}

export function donorPath(donorId: string): string {
  return docPath("donors", donorId);
}

/** The donor as they were at gift time (receipts never change retroactively). */
export function donorSnapshotOf(d: DonorInput): DonorSnapshot {
  const email = d.email.trim();
  return {
    fullName: d.fullName.trim(),
    donorType: d.type,
    organisationName: d.type === "organisation" ? (d.organisation?.trim() || null) : null,
    email,
    emailLower: email.toLowerCase(),
    phone: d.phone?.trim() || null,
    country: d.country as CountryCode,
  };
}

/** Reads the donor inside a transaction (call before any write of the same transaction). */
export async function readDonorTx(tx: Tx, donorId: string, root?: string): Promise<WithId<Donor> | null> {
  return tx.get<Donor>(root ? `${root}/${donorPath(donorId)}` : donorPath(donorId));
}

export type DonorUpsert = {
  donorId: string;
  snapshot: DonorSnapshot;
  recognition: Donor["recognition"];
  /** A fresh consent tick, or null when the donor did not ask for updates this time. */
  updatesConsent: ConsentStamp | null;
  now: Millis;
  /** Selftests only: a scratch root prefixed to the donor path. */
  root?: string;
};

/**
 * Creates the donor, or refreshes an existing one with the latest details. An earlier consent is kept
 * when the donor leaves the box unticked this time (withdrawal happens through unsubscribe links).
 */
export function upsertDonorTx(tx: Tx, existing: WithId<Donor> | null, u: DonorUpsert): void {
  const path = u.root ? `${u.root}/${donorPath(u.donorId)}` : donorPath(u.donorId);
  const s = u.snapshot;
  const tokens = buildSearchTokens({ email: s.email, names: [s.fullName, s.organisationName], phone: s.phone });
  if (!existing) {
    const donor: Donor = {
      email: s.email,
      emailLower: s.emailLower,
      fullName: s.fullName,
      donorType: s.donorType,
      organisationName: s.organisationName,
      country: s.country,
      phone: s.phone,
      recognition: u.recognition,
      updatesConsent: u.updatesConsent,
      updatesWithdrawnAt: null,
      stripeCustomerId: null,
      totals: {},
      firstGiftAt: u.now,
      lastGiftAt: u.now,
      activeRecurring: 0,
      searchTokens: tokens,
      retention: { policy: "donor.profile", retainUntil: null, legalHold: false },
      createdAt: u.now,
      updatedAt: u.now,
      version: 1,
    };
    tx.create(path, donor);
    return;
  }
  tx.update(path, {
    email: s.email,
    emailLower: s.emailLower,
    fullName: s.fullName,
    donorType: s.donorType,
    organisationName: s.organisationName,
    country: s.country,
    // Keep a phone number given earlier when this gift came without one.
    phone: s.phone ?? existing.phone ?? null,
    recognition: u.recognition,
    ...(u.updatesConsent ? { updatesConsent: u.updatesConsent, updatesWithdrawnAt: null } : {}),
    firstGiftAt: existing.firstGiftAt ?? u.now,
    lastGiftAt: u.now,
    searchTokens: tokens,
    updatedAt: u.now,
    version: (existing.version ?? 0) + 1,
  });
}
