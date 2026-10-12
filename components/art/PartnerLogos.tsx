// Five original placeholder partner badges in Donat's monochrome "trusted by" style.
// CLIENT: replace with real partner logos (with permission) before launch.

const nunito = { fontFamily: "var(--font-nunito)" } as const;
const anton = { fontFamily: "var(--font-anton)" } as const;

function Laurel({ cx, cy, r, side, leaves = 7 }: { cx: number; cy: number; r: number; side: 1 | -1; leaves?: number }) {
  const items = [];
  for (let i = 0; i < leaves; i++) {
    const a = (Math.PI * (0.62 + (i / (leaves - 1)) * 0.72)) as number; // sweep up the side
    const x = cx + side * Math.cos(a) * r * -1;
    const y = cy + Math.sin(a) * r;
    const rot = (side === 1 ? -1 : 1) * ((a * 180) / Math.PI - 90) + (side === 1 ? -35 : 35);
    items.push(<ellipse key={i} cx={x} cy={y} rx={2.1} ry={5.4} transform={`rotate(${rot} ${x} ${y})`} />);
  }
  return <g>{items}</g>;
}

export function PartnerCareAlliance({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 80" className={className} fill="currentColor" aria-label="Community Care Alliance (placeholder)">
      <Laurel cx={75} cy={36} r={46} side={1} />
      <Laurel cx={75} cy={36} r={46} side={-1} />
      <text x="75" y="31" textAnchor="middle" fontSize="15" fontWeight="900" style={nunito} letterSpacing="0.5">CARE</text>
      <text x="75" y="42" textAnchor="middle" fontSize="7.5" fontWeight="800" style={nunito} letterSpacing="1.2">ALLIANCE</text>
      <text x="75" y="52" textAnchor="middle" fontSize="6.5" style={nunito}>★ ★ ★ ★ ★</text>
      <text x="75" y="63" textAnchor="middle" fontSize="7.5" fontWeight="900" style={nunito} letterSpacing="1.4">MEMBER</text>
    </svg>
  );
}

export function PartnerKidsFirst({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 80" className={className} fill="currentColor" aria-label="Kids First Fund (placeholder)">
      <rect x="4" y="18" width="46" height="46" rx="11" />
      <text x="27" y="51" textAnchor="middle" fontSize="23" style={anton} fill="#fcf9ea">KF</text>
      <text x="60" y="34" fontSize="17" fontWeight="900" style={nunito} letterSpacing="0.6">KIDS</text>
      <text x="60" y="52" fontSize="17" fontWeight="900" style={nunito} fill="none" stroke="currentColor" strokeWidth="1" letterSpacing="1">FIRST</text>
      <text x="60" y="66" fontSize="11" fontWeight="900" style={nunito} letterSpacing="2.4">FUND</text>
    </svg>
  );
}

export function PartnerSchoolsTrust({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 80" className={className} fill="currentColor" aria-label="United Schools Trust (placeholder)">
      <circle cx="45" cy="40" r="30" fill="none" stroke="currentColor" strokeWidth="2.4" strokeDasharray="3 3.2" />
      <circle cx="45" cy="40" r="24" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <text x="45" y="30" textAnchor="middle" fontSize="5" style={nunito}>★ ★ ★</text>
      <text x="45" y="39" textAnchor="middle" fontSize="7.5" fontWeight="900" style={nunito}>UNITED</text>
      <text x="45" y="47" textAnchor="middle" fontSize="6" fontWeight="800" style={nunito} letterSpacing="0.6">SCHOOLS</text>
      <text x="45" y="55" textAnchor="middle" fontSize="6" fontWeight="800" style={nunito} letterSpacing="1.2">TRUST</text>
    </svg>
  );
}

export function PartnerGlobalHealth({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 170 80" className={className} fill="currentColor" aria-label="Global Health Partners (placeholder)">
      <rect x="4" y="16" width="162" height="48" rx="24" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="11" y="23" width="148" height="34" rx="17" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <text x="22" y="34" fontSize="6" fontWeight="800" style={nunito} letterSpacing="1.4">INTERNATIONAL</text>
      <text x="22" y="46" fontSize="13" style={anton} letterSpacing="1" fill="none" stroke="currentColor" strokeWidth="0.9">HEALTH</text>
      <text x="22" y="54" fontSize="6.4" fontWeight="900" style={nunito} letterSpacing="1.6">PARTNERS</text>
      <g fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="137" cy="40" r="16" />
        <ellipse cx="137" cy="40" rx="7" ry="16" />
        <path d="M121 40h32M123.5 32h27M123.5 48h27M137 24v32" />
      </g>
    </svg>
  );
}

export function PartnerCarepoint({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 150 80" className={className} fill="currentColor" aria-label="Carepoint (placeholder)">
      <rect x="22" y="14" width="22" height="22" rx="3" />
      <circle cx="58" cy="25" r="11" />
      <circle cx="82" cy="25" r="11" />
      <text x="20" y="60" fontSize="21" fontWeight="800" style={nunito} letterSpacing="-0.4">carepoint</text>
      <circle cx="118" cy="46" r="2.2" />
    </svg>
  );
}

export const partnerLogos = [PartnerCareAlliance, PartnerKidsFirst, PartnerSchoolsTrust, PartnerGlobalHealth, PartnerCarepoint];
