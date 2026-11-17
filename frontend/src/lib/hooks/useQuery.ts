"use client";

import { useCallback, useEffect, useState } from "react";
import { useOptionalAuth } from "@/components/auth/AuthProvider";

export type QueryState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "error"; data?: undefined; error: unknown }
  | { status: "success"; data: T; error?: undefined };

type Settled<T> = { key: string } & ({ ok: true; data: T } | { ok: false; error: unknown });

/**
 * Minimal data loader with loading/error/success states and a reload().
 * `deps` must be JSON-serialisable (ids, strings); a change re-runs `load`.
 *
 * Inside an AuthProvider it waits until the session is confirmed, and refetches
 * when the active business changes. On public pages it runs straight away.
 */
export function useQuery<T>(load: () => Promise<T>, deps: readonly unknown[]) {
  const auth = useOptionalAuth();
  const enabled = !auth || auth.ready;
  const [nonce, setNonce] = useState(0);
  const key = JSON.stringify([deps, nonce, auth?.business?.id ?? null]);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    load().then(
      (data) => active && setSettled({ key, ok: true, data }),
      (error: unknown) => active && setSettled({ key, ok: false, error }),
    );
    return () => {
      active = false;
    };
    // `key` captures deps, reload nonce and active business.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  // Anything settled for an older key is stale: show loading until the new result lands.
  const state: QueryState<T> =
    !enabled || !settled || settled.key !== key
      ? { status: "loading" }
      : settled.ok
        ? { status: "success", data: settled.data }
        : { status: "error", error: settled.error };

  return { ...state, reload };
}
