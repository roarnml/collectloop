import { add, toMinor, zero } from "@/lib/format/money";
import { DEFAULT_ASSET } from "@/lib/config";
import type { Money, PaymentRequest, PaymentRequestStatus } from "@/lib/types";

/**
 * Totals built from payment requests. Every amount comes from the backend's
 * verified figures (amount_paid only counts succeeded transactions), so these
 * never count pending or failed payments as received.
 *
 * Amounts in different currencies can't be added together: totals use the
 * most common currency and `otherCurrencies` counts requests left out.
 */

export interface Totals {
  currency: Pick<Money, "assetCode" | "assetScale">;
  requested: Money;
  received: Money;
  outstanding: Money;
  overdue: Money;
  count: number;
  openCount: number;
  paidCount: number;
  overdueCount: number;
  otherCurrencies: number;
}

function primaryCurrency(requests: PaymentRequest[]): Pick<Money, "assetCode" | "assetScale"> {
  const counts = new Map<string, { n: number; m: Money }>();
  for (const r of requests) {
    const key = `${r.amount.assetCode}/${r.amount.assetScale}`;
    const e = counts.get(key);
    if (e) e.n += 1;
    else counts.set(key, { n: 1, m: r.amount });
  }
  let best: Money | null = null;
  let bestN = 0;
  for (const { n, m } of counts.values()) {
    if (n > bestN) {
      best = m;
      bestN = n;
    }
  }
  return best ? { assetCode: best.assetCode, assetScale: best.assetScale } : DEFAULT_ASSET;
}

const CLOSED: PaymentRequestStatus[] = ["cancelled", "expired"];

export function totals(requests: PaymentRequest[]): Totals {
  const currency = primaryCurrency(requests);
  const same = requests.filter(
    (r) => r.amount.assetCode === currency.assetCode && r.amount.assetScale === currency.assetScale,
  );
  const live = same.filter((r) => !CLOSED.includes(r.status));
  const z = zero(currency);
  return {
    currency,
    requested: live.reduce((s, r) => add(s, r.amount), z),
    received: same.reduce((s, r) => add(s, r.amount_paid), z),
    outstanding: live.reduce((s, r) => add(s, r.outstanding_amount), z),
    overdue: same.filter((r) => r.status === "overdue").reduce((s, r) => add(s, r.outstanding_amount), z),
    count: requests.length,
    openCount: requests.filter((r) => r.status === "open" || r.status === "partially_paid" || r.status === "overdue").length,
    paidCount: requests.filter((r) => r.status === "paid").length,
    overdueCount: requests.filter((r) => r.status === "overdue").length,
    otherCurrencies: requests.length - same.length,
  };
}

/** Totals per customer id. */
export function totalsByCustomer(requests: PaymentRequest[]): Map<string, Totals & { lastRequestAt: string | null }> {
  const groups = new Map<string, PaymentRequest[]>();
  for (const r of requests) {
    const list = groups.get(r.customer.id);
    if (list) list.push(r);
    else groups.set(r.customer.id, [r]);
  }
  const out = new Map<string, Totals & { lastRequestAt: string | null }>();
  for (const [id, list] of groups) {
    const last = list.reduce<string | null>((m, r) => (!m || r.created_at > m ? r.created_at : m), null);
    out.set(id, { ...totals(list), lastRequestAt: last });
  }
  return out;
}

/** Share of `part` in `whole`, 0–100, for display. */
export function percent(part: Money, whole: Money): number {
  const w = toMinor(whole);
  if (w <= 0n) return 0;
  return Math.min(100, Math.max(0, Number((toMinor(part) * 1000n) / w) / 10));
}
