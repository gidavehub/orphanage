import { createElement, isValidElement, type ReactElement } from "react";
import type { LucideIcon } from "lucide-react";
import { ProgrammeIcon } from "@/components/art/ProgrammeIcons";
import { isProgrammeId, type ProgrammeId } from "@/lib/model/enums";

/**
 * An icon prop: a lucide component (`ShieldAlert`) or a ready element (`<ShieldAlert />`).
 * Server components may pass either; client components receiving props from the server must get
 * an element, because component functions cannot cross the server/client boundary.
 */
export type IconLike = LucideIcon | ReactElement;

/** Disc icons also accept a programme id, which renders the duotone ProgrammeIcon. */
export type DiscIcon = ProgrammeId | IconLike;

function isComponent(icon: unknown): icon is LucideIcon {
  return typeof icon === "function" || (typeof icon === "object" && icon !== null && !isValidElement(icon) && "$$typeof" in icon);
}

/** Renders an IconLike with the given class (elements are returned as they are). */
export function renderIcon(icon: IconLike | null | undefined, className?: string, strokeWidth = 2.25): React.ReactNode {
  if (!icon) return null;
  if (isValidElement(icon)) return icon;
  if (isComponent(icon)) return createElement(icon, { className, strokeWidth, "aria-hidden": true });
  return null;
}

/** Renders a DiscIcon (programme id, lucide component or element). */
export function renderDiscIcon(icon: DiscIcon, className?: string, strokeWidth = 2.25): React.ReactNode {
  if (typeof icon === "string") return isProgrammeId(icon) ? <ProgrammeIcon name={icon} className={className} /> : null;
  return renderIcon(icon, className, strokeWidth);
}
