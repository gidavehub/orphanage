import type { Metadata } from "next";

export const metadata: Metadata = { title: "Concern" };

export default function SafeguardingHome() {
  return (
    <div className="rounded-[20px] bg-white p-8 text-center shadow-soft">
      <p className="text-[17px] font-extrabold text-deep">Pick a concern from the list</p>
      <p className="mt-2 text-[15px] text-body">Opening a concern is recorded, and the first open stops the repeat alerts.</p>
    </div>
  );
}
