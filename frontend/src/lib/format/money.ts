import type { Money } from "@/lib/types";

/**
 * Money helpers. Amounts are integer minor-unit strings (Open Payments
 * `value` + `assetScale`). All arithmetic uses BigInt; floats never touch money.
 */

export function toMinor(m: Money): bigint {
  return BigInt(m.value);
}

export function money(value: bigint, assetCode: string, assetScale: number): Money {
  return { value: value.toString(), assetCode, assetScale };
}

export function zero(like: Pick<Money, "assetCode" | "assetScale">): Money {
  return money(0n, like.assetCode, like.assetScale);
}

export function sameAsset(a: Money, b: Money): boolean {
  return a.assetCode === b.assetCode && a.assetScale === b.assetScale;
}

function assertSameAsset(a: Money, b: Money) {
  if (!sameAsset(a, b)) {
    throw new Error(
      `Asset mismatch: ${a.assetCode}/${a.assetScale} vs ${b.assetCode}/${b.assetScale}`,
    );
  }
}

export function add(a: Money, b: Money): Money {
  assertSameAsset(a, b);
  return money(toMinor(a) + toMinor(b), a.assetCode, a.assetScale);
}

/** a − b, bounded at zero (outstanding can never go negative). */
export function subtractFloor(a: Money, b: Money): Money {
  assertSameAsset(a, b);
  const diff = toMinor(a) - toMinor(b);
  return money(diff > 0n ? diff : 0n, a.assetCode, a.assetScale);
}

/** Paid fraction 0–100 for progress bars. Display only. */
export function percentOf(part: Money, total: Money): number {
  const t = toMinor(total);
  if (t <= 0n) return 0;
  const pct = Number((toMinor(part) * 10000n) / t) / 100;
  return Math.max(0, Math.min(100, pct));
}

/**
 * Parse user input like "1,500.50" into minor units for the given scale.
 * Returns null if the input is not a valid positive amount at that precision.
 */
export function parseAmount(input: string, assetScale: number): bigint | null {
  const cleaned = input.replace(/[,\s]/g, "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole, frac = ""] = match;
  if (frac.length > assetScale) return null;
  const minor = BigInt(whole + frac.padEnd(assetScale, "0"));
  return minor;
}

function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat("en", { style: "currency", currency: code, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((p) => p.type === "currency");
    return part?.value ?? code;
  } catch {
    // Non-ISO asset codes (possible on test networks) fall back to the code.
    return code;
  }
}

/** Format for display, e.g. "₦15,000.00". Display only; never parse this back. */
export function formatMoney(m: Money, opts: { showCode?: boolean } = {}): string {
  const minor = toMinor(m);
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const s = abs.toString().padStart(m.assetScale + 1, "0");
  const whole = m.assetScale > 0 ? s.slice(0, -m.assetScale) : s;
  const frac = m.assetScale > 0 ? s.slice(-m.assetScale) : "";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const symbol = currencySymbol(m.assetCode);
  const body = `${symbol}${grouped}${frac ? `.${frac}` : ""}`;
  const withCode = opts.showCode && symbol !== m.assetCode ? `${body} ${m.assetCode}` : body;
  return negative ? `-${withCode}` : withCode;
}

/** Plain decimal string for prefilling inputs, e.g. "1500.00". */
export function toDecimalString(m: Money): string {
  const s = toMinor(m).toString().padStart(m.assetScale + 1, "0");
  return m.assetScale > 0 ? `${s.slice(0, -m.assetScale)}.${s.slice(-m.assetScale)}` : s;
}
