import type { AuthTokens } from "@/lib/types";

/**
 * Where the browser keeps the signed-in session.
 *
 * Tokens are in localStorage so the dashboard survives reloads and new tabs.
 * That is readable by any script on the page, so an XSS bug could steal them.
 * Better: have Django set the refresh token as an httpOnly, Secure, SameSite
 * cookie and keep only the short-lived access token in memory. This module is
 * the one place to change when that happens.
 *
 * Never store Open Payments keys or provider tokens here; those stay on the backend.
 */

const TOKENS_KEY = "paytrain.auth";
const BUSINESS_KEY = "paytrain.business";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked; the session lasts for this page only.
  }
}

export function getTokens(): AuthTokens | null {
  const raw = read(TOKENS_KEY);
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Partial<AuthTokens>;
    return typeof t.access === "string" && typeof t.refresh === "string" ? { access: t.access, refresh: t.refresh } : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens | null) {
  write(TOKENS_KEY, tokens ? JSON.stringify(tokens) : null);
}

/** The business the owner is currently working in. */
export function getActiveBusinessId(): string | null {
  return read(BUSINESS_KEY);
}

export function setActiveBusinessId(id: string | null) {
  write(BUSINESS_KEY, id);
}

export function clearSession() {
  setTokens(null);
  setActiveBusinessId(null);
}

const SESSION_ENDED = "paytrain:session-ended";

/** Tell the app the backend rejected our session (expired or revoked tokens). */
export function notifySessionEnded() {
  clearSession();
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_ENDED));
}

export function onSessionEnded(handler: () => void): () => void {
  window.addEventListener(SESSION_ENDED, handler);
  return () => window.removeEventListener(SESSION_ENDED, handler);
}

/** Login URL that returns the user to the current page afterwards. */
export function loginUrl(reason?: "expired" | "unreachable"): string {
  const here = window.location.pathname + window.location.search;
  const params = new URLSearchParams({ next: here });
  if (reason) params.set("reason", reason);
  return `/login?${params.toString()}`;
}

/** Only allow same-site relative paths as a post-login destination. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
