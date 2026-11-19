"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, isUnauthorized } from "@/lib/api";
import { getActiveBusinessId, getTokens, loginUrl, onSessionEnded, setActiveBusinessId } from "@/lib/auth/session";
import type { Business, User } from "@/lib/types";

type AuthState =
  | { status: "loading" }
  | { status: "ready"; user: User; businesses: Business[]; businessId: string | null };

export interface AuthContextValue {
  state: AuthState;
  /** Set once the session is confirmed; data hooks wait for this. */
  ready: boolean;
  user: User | null;
  businesses: Business[];
  /** Null while loading, or on pages that allow no business (setup). */
  business: Business | null;
  selectBusiness(id: string): void;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Null outside an AuthProvider (public customer pages). */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

/**
 * Gate for signed-in pages. Sends anyone without a confirmed session to
 * /login (and back afterwards): no tokens, rejected tokens, a session that
 * ends mid-use, or a session that can't be checked because the server is
 * unreachable. Owners without a business go to /setup.
 *
 * Children render immediately (in their loading state) so layouts and
 * navigation stay instant; data hooks wait for `ready` before fetching.
 *
 * This only controls what the browser shows. The real protection is the
 * backend rejecting requests without a valid token.
 */
export function AuthProvider({
  children,
  requireBusiness = true,
}: {
  children: ReactNode;
  requireBusiness?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // Any API call that comes back 401 after a refresh attempt ends the session.
  useEffect(() => onSessionEnded(() => router.replace(loginUrl("expired"))), [router]);

  useEffect(() => {
    if (!getTokens()) {
      router.replace(loginUrl());
      return;
    }
    let active = true;
    Promise.all([api.getCurrentUser(), api.listBusinesses()]).then(
      ([user, businesses]) => {
        if (!active) return;
        if (businesses.length === 0 && requireBusiness) {
          router.replace("/setup");
          return;
        }
        const stored = getActiveBusinessId();
        const businessId = businesses.some((b) => b.id === stored) ? stored : (businesses[0]?.id ?? null);
        setActiveBusinessId(businessId);
        setState({ status: "ready", user, businesses, businessId });
      },
      (error: unknown) => {
        if (!active) return;
        // Couldn't confirm the session: treat as signed out. The login page explains why.
        router.replace(loginUrl(isUnauthorized(error) ? "expired" : "unreachable"));
      },
    );
    return () => {
      active = false;
    };
  }, [router, requireBusiness]);

  const selectBusiness = useCallback((id: string) => {
    setActiveBusinessId(id);
    setState((s) => (s.status === "ready" ? { ...s, businessId: id } : s));
  }, []);

  const signOut = useCallback(async () => {
    await api.logout();
    router.replace("/login");
  }, [router]);

  const ready = state.status === "ready";
  const value: AuthContextValue = {
    state,
    ready,
    user: ready ? state.user : null,
    businesses: ready ? state.businesses : [],
    business: ready ? (state.businesses.find((b) => b.id === state.businessId) ?? null) : null,
    selectBusiness,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
