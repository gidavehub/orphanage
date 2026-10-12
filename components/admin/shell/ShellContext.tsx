"use client";

import { createContext, useContext } from "react";
import type { Area, GlobalSheet, Place } from "@/lib/admin/access";
import type { PulseDTO, ShellViewer } from "@/lib/model/dto";
import type { SignOutAction } from "@/components/admin/auth/SignOutButton";

export type ShellPlaces = { pill: Place[]; more: Place[]; dockPrimary: Place };
export type QuickAction = { id: GlobalSheet; label: string; icon: string };
export type ShellPanel = "find" | "new" | "places" | "updates";

export type ShellState = {
  viewer: ShellViewer;
  places: ShellPlaces;
  quickActions: QuickAction[];
  /** The place the current route belongs to (from the ActivePlace leaf). */
  activeArea: Area | null;
  /** Latest badge counts, or null until the first pulse answers. */
  pulse: PulseDTO | null;
  /** Unread updates for the bell's dot. */
  unreadUpdates: number;
  openPanel: (panel: ShellPanel) => void;
  signOutAction: SignOutAction;
};

export const ShellContext = createContext<ShellState | null>(null);

/** The shell's state for desk components (badges, the signed-in person, opening Find or ＋ New). */
export function useShell(): ShellState {
  const s = useContext(ShellContext);
  if (!s) throw new Error("useShell() must be used inside <AdminShell>.");
  return s;
}

/** Like useShell(), but null outside the shell (components shared with auth pages). */
export function useOptionalShell(): ShellState | null {
  return useContext(ShellContext);
}
