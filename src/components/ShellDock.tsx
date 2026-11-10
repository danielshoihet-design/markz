"use client";

import { createContext, useContext } from "react";

/**
 * The slot directly above the bottom navigation. A page can portal a bar into
 * it (the chat composer does) so the bar stays pinned above the navigation
 * whatever height the navigation ends up being.
 */
export const ShellDockContext = createContext<HTMLElement | null>(null);

export function useShellDock() {
  return useContext(ShellDockContext);
}
