import { ViewTransition } from "react";

// Route transitions for the public site (public-pages §2.7, design-system §4.6). A template re-mounts
// on every navigation, so each page enters with the soft rise ("page-in") while the old one fades
// ("page-out"); the keyframes live in globals.css and collapse to an instant swap under
// prefers-reduced-motion. default="none" keeps form submissions and filters from animating the page.
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      {children}
    </ViewTransition>
  );
}
