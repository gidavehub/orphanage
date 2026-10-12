import type { ReceiptDTO } from "@/lib/server/dal/donations";

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Banjul" });

/**
 * A donation receipt (admin-ux §6.6 Receipt): A4 and Letter print styles, the organisation's details
 * from Key information and the registration numbers from site settings. "Print or save as PDF".
 */
export function ReceiptDocument({
  r,
  org,
}: {
  r: ReceiptDTO;
  org: { name: string; legalName: string; address: string; email: string; phone: string; registrations: Array<{ label: string; number: string }> };
}) {
  return (
    <article className="mx-auto w-full max-w-[760px] rounded-[18px] bg-white p-8 text-ink shadow-soft print:max-w-none print:rounded-none print:p-0 print:shadow-none md:p-12">
      <style>{"@page { size: auto; margin: 18mm; } @media print { body { background: #fff !important; } }"}</style>
      <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-forest pb-6">
        <div>
          <p className="font-display text-[34px] uppercase leading-none text-forest">{org.name}</p>
          <p className="mt-2 text-[14px] text-body">{org.legalName}</p>
          <p className="text-[14px] text-body">{org.address}</p>
          <p className="text-[14px] text-body">
            {org.email} · {org.phone}
          </p>
        </div>
        <div className="text-right">
          <p className="font-grotesk text-[12px] font-semibold uppercase tracking-[0.12em] text-body">Receipt</p>
          <p className="font-grotesk text-[20px] font-semibold tabular-nums">{r.number}</p>
          <p className="text-[14px] text-body">Issued {dateFmt.format(r.issuedAt)}</p>
        </div>
      </header>
      <dl className="mt-8 grid gap-3 text-[16px]">
        <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
          <dt className="text-body">Received from</dt>
          <dd className="font-bold">{r.donor}</dd>
        </div>
        <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
          <dt className="text-body">{r.kind === "cash" ? "Amount" : "Gift"}</dt>
          <dd className="font-bold">{r.amount}</dd>
        </div>
        {r.items ? (
          <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
            <dt className="text-body">Items</dt>
            <dd>{r.items}</dd>
          </div>
        ) : null}
        <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
          <dt className="text-body">Frequency</dt>
          <dd>{r.frequency}</dd>
        </div>
        {r.receivedAt ? (
          <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
            <dt className="text-body">Date received</dt>
            <dd>{dateFmt.format(r.receivedAt)}</dd>
          </div>
        ) : null}
        <div className="grid grid-cols-[170px_minmax(0,1fr)] gap-4">
          <dt className="text-body">Gift reference</dt>
          <dd className="font-grotesk tabular-nums">{r.ref}</dd>
        </div>
      </dl>
      <p className="mt-10 text-[15px] leading-relaxed">Thank you. Your generosity helps children and families get the support they need.</p>
      {org.registrations.length ? (
        <p className="mt-8 border-t border-line pt-4 text-[13px] text-body">{org.registrations.map((x) => `${x.label}: ${x.number}`).join(" · ")}</p>
      ) : null}
    </article>
  );
}
