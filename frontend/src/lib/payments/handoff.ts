import type { Money } from "@/lib/types";

/**
 * Details of a payment attempt handed from the pay page to the status page,
 * for this browser tab only. Lets the status page show the payment link even
 * if the first verification call fails.
 */
export interface PaymentHandoff {
  url: string;
  amount: Money;
  reference: string;
  businessName: string;
}

const key = (paymentId: string) => `paytrain.payment.${paymentId}`;

export function saveHandoff(paymentId: string, handoff: PaymentHandoff) {
  try {
    window.sessionStorage.setItem(key(paymentId), JSON.stringify(handoff));
  } catch {
    // Storage blocked; the status page will still verify, just without the link.
  }
}

/** Raw stored JSON (a stable string, safe for useSyncExternalStore). */
export function readHandoffRaw(paymentId: string): string | null {
  try {
    return window.sessionStorage.getItem(key(paymentId));
  } catch {
    return null;
  }
}

export function parseHandoff(raw: string | null): PaymentHandoff | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaymentHandoff;
  } catch {
    return null;
  }
}
