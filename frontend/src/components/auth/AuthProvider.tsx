"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ErrorState } from "@/components/ui";
import { api, isUnauthorized } from "@/lib/api";
import { getActiveBusinessId, getTokens, setActiveBusinessId } from "@/lib/auth/session";
import type { Business, User } from "@/lib/types";

type AuthState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
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

function loginUrl() {
  const here = window.location.pathname + window.location.search;
  return `/login?next=${encodeURIComponent(here)}`;
}

/**
 * Gate for signed-in pages. Sends signed-out visitors to /login (and back
 * afterwards), and owners without a business to /setup.
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
  const [attempt, setAttempt] = useState(0);

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
        if (isUnauthorized(error)) router.replace(loginUrl());
        else setState({ status: "error", error });
      },
    );
    return () => {
      active = false;
    };
  }, [router, requireBusiness, attempt]);

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
      {state.status === "error" ? (
        <div className="mx-auto max-w-md px-4 py-16">
          <ErrorState
            error={state.error}
            onRetry={() => {
              setState({ status: "loading" });
              setAttempt((n) => n + 1);
            }}
          />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
}
