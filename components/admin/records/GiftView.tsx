import Link from "next/link";
import { ChevronLeft, Printer, Receipt } from "lucide-react";
import { GiftControls } from "@/components/admin/giving/GiftControls";
import { FlagDisc, hasFlag } from "@/components/ui/flag";
import { formatStaffDate, formatStaffDateTime } from "@/lib/admin/format";
import { countryName } from "@/lib/countries";
import type { ActionResult } from "@/lib/forms/types";
import type { Millis } from "@/lib/model/enums";
import type { Permission } from "@/lib/model/permissions";
import { formatMoney } from "@/lib/money";
import type { GiftDetailDTO } from "@/lib/server/dal/donations";

export type GiftViewProps = {
  d: GiftDetailDTO;
  tz: string;
  perms: Permission[];
  move: (ref: string, kind: "cash" | "in_kind", edgeId: string, expectedVersion: number, input?: Record<string, unknown>) => Promise<ActionResult<{ version: number; at: Millis; status: string }>>;
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-3 py-1.5 text-[14.5px]">
      <dt className="text-body">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

/**
 * A gift or an in-kind offer (admin-ux §6.6): the amount large, who gave it, the stage, then the two
 * checklist cards that drive it: "Say thank you" (receipt) and "Put it towards" (allocations).
 */
export function GiftView({ d, tz, perms, move }: GiftViewProps) {
  const left = d.amount ? d.amount.amountMinor - d.placedMinor : 0;
  return (
    <article aria-label={`Gift ${d.ref}`} className="grid gap-5">
      <header className="rounded-[26px] bg-white p-5 shadow-soft md:p-6">
        <Link href="/admin/giving" className="mb-3 inline-flex min-h-10 items-center gap-1 text-[14px] font-bold text-forest">
          <ChevronLeft aria-hidden className="size-4" strokeWidth={2.5} /> Giving
        </Link>
        <p className="font-grotesk text-[13px] font-semibold tabular-nums text-umber">{d.ref}</p>
        <p className="mt-1 font-display text-[44px] leading-none text-ink md:text-[56px]">{d.amountLabel}</p>
        <p className="mt-2 text-[14.5px] text-body">
          {d.kind === "cash" ? `${d.frequency} · ${d.method ?? "Not recorded yet"}` : `In kind · ${d.inKind?.items ?? ""}`}
          {d.externalRef ? ` · ref ${d.externalRef}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[14.5px] text-ink">
          {d.donor.name}
          {hasFlag(d.donor.country) ? <FlagDisc code={d.donor.country} className="size-4" /> : null}
          <span className="text-body">
            · {countryName(d.donor.country)} · {d.donor.type} · {d.donor.updates ? "Happy to get updates ✓" : "No updates"} · {d.donor.anonymous ? "Keep anonymous" : "Show name ✓"}
          </span>
        </p>
        <div className="mt-6">
          <GiftControls d={d} perms={perms} tz={tz} move={move} />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-[22px] bg-white p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-[16px] font-extrabold text-ink">
            <Receipt aria-hidden className="size-5 text-forest" /> Say thank you
          </h3>
          {d.receipt ? (
            <>
              <p className="text-[15px] text-ink">
                Receipt <span className="font-grotesk font-semibold tabular-nums">{d.receipt.number}</span> issued {formatStaffDate(d.receipt.issuedAt, tz)}.
              </p>
              <Link href={`/admin/giving/${encodeURIComponent(d.ref)}/receipt`} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full border border-line px-4 text-[14px] font-bold text-ink hover:border-forest">
                <Printer aria-hidden className="size-4" /> Print receipt
              </Link>
            </>
          ) : (
            <p className="text-[15px] text-body">{d.status === "received" ? "Not sent yet. Use “Send thank-you and receipt” above." : "The thank-you is sent once the gift has arrived."}</p>
          )}
        </section>
        <section className="rounded-[22px] bg-white p-5 shadow-soft">
          <h3 className="mb-3 text-[16px] font-extrabold text-ink">Put it towards</h3>
          <p className="mb-3 text-[14px] text-body">Donor chose: {d.preferred}</p>
          {d.allocations.length ? (
            <ul className="grid gap-1.5">
              {d.allocations.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 text-[15px]">
                  <span className="text-ink">{a.label}</span>
                  <span className="font-grotesk font-semibold tabular-nums">{formatMoney({ amountMinor: a.amountMinor, currency: a.currency })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[15px] text-body">Not placed yet.</p>
          )}
          {d.amount && d.kind === "cash" ? (
            <p className={`mt-3 text-[14px] font-bold ${left === 0 ? "text-forest" : "text-umber"}`}>{left === 0 ? "All of it is placed ✓" : `${formatMoney({ amountMinor: left, currency: d.amount.currency })} left to place`}</p>
          ) : null}
        </section>
      </div>

      <section className="rounded-[22px] bg-white p-5 shadow-soft">
        <h3 className="mb-2 text-[16px] font-extrabold text-ink">Details</h3>
        <dl>
          <Row label="Recorded">{formatStaffDateTime(d.createdAt, tz)}</Row>
          {d.receivedAt ? <Row label="Received">{formatStaffDate(d.receivedAt, tz)}</Row> : null}
          {d.donor.email ? <Row label="Email">{d.donor.email.value}</Row> : null}
          {d.donor.phone ? <Row label="Phone">{d.donor.phone.value}</Row> : null}
          {d.sponsorRef ? <Row label="Sponsorship">{d.sponsorRef}</Row> : null}
          {d.comments ? <Row label="Their note">{d.comments}</Row> : null}
          {d.inKind ? (
            <>
              <Row label="Description">{d.inKind.description}</Row>
              {d.inKind.quantity ? <Row label="Quantity">{d.inKind.quantity}</Row> : null}
              <Row label="Handover">{d.inKind.delivery}</Row>
              {d.inKind.received.map((r, i) => (
                <Row key={i} label={i === 0 ? "Arrived" : ""}>
                  {r.description} {r.quantity ? `(${r.quantity})` : ""} · {formatStaffDate(r.at, tz)}
                </Row>
              ))}
            </>
          ) : null}
          {d.cancelReason ? <Row label="Cancelled">{d.cancelReason.replace(/_/g, " ")}</Row> : null}
          <Row label="Their other gifts">{d.otherGifts}</Row>
        </dl>
      </section>
    </article>
  );
}
