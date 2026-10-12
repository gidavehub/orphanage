import {
  BookOpen,
  CalendarClock,
  CalendarHeart,
  CircleHelp,
  FilePlus,
  FileText,
  Globe,
  HandHeart,
  Heart,
  History,
  House,
  Image as ImageIcon,
  Inbox,
  Newspaper,
  NotebookPen,
  PenLine,
  Phone,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Upload,
  UserCog,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

/** lib/admin/access.ts names its place and quick-action icons as strings (client-safe data); this maps them. */
const ICONS: Record<string, LucideIcon> = {
  House,
  Inbox,
  HandHeart,
  ShieldCheck,
  Heart,
  CalendarHeart,
  BookOpen,
  Users,
  Globe,
  Newspaper,
  Image: ImageIcon,
  UserCog,
  History,
  Settings,
  PenLine,
  Phone,
  ShieldAlert,
  CalendarClock,
  NotebookPen,
  FileText,
  FilePlus,
  Upload,
  UserPlus,
};

export function PlaceIcon({ name, className, strokeWidth = 2.25 }: { name: string; className?: string; strokeWidth?: number }) {
  const Icon = ICONS[name] ?? CircleHelp;
  return <Icon aria-hidden className={cn("shrink-0", className)} strokeWidth={strokeWidth} />;
}
