import type { Metadata } from "next";
import { SkipLink } from "@/components/layout/SkipLink";
import { COPY } from "@/lib/admin/copy";

// The admin's non-root layout (PLAN D1, D125, D135): noindex, the "Haven team" title template, the
// home-screen manifest, the paper canvas and the forest focus ring (D117). No Lenis, no GSAP, no
// session read here: (desk)/layout.tsx reads the session inside Suspense (D3), and the auth pages
// (login, code, confirm, locked) render their own frame.

export const metadata: Metadata = {
  title: { default: COPY["app.name"], template: COPY["app.titleTemplate"] },
  robots: { index: false, follow: false, nocache: true },
  manifest: "/admin.webmanifest",
  appleWebApp: { capable: true, title: COPY["app.name"], statusBarStyle: "default" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="paper min-h-dvh text-ink focus-forest">
      <SkipLink label={COPY["app.skipLink"]} />
      {children}
    </div>
  );
}
