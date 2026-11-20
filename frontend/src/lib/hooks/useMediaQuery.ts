"use client";

import { useSyncExternalStore } from "react";

/** Live result of a CSS media query. False during server rendering. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `md` breakpoint (768px), where tables show as cards. */
export function useIsPhone(): boolean {
  return useMediaQuery("(max-width: 767.98px)");
}
