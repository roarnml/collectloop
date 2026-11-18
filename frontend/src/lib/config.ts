/**
 * Currency for new payment requests. Defaults to Nigerian naira in kobo
 * (assetScale 2, so "1500000" = ₦15,000.00).
 *
 * In live mode this MUST match the business's Open Payments wallet: the
 * backend rejects a payment attempt whose currency differs from the wallet's
 * asset. Override with NEXT_PUBLIC_DEFAULT_CURRENCY (e.g. USD) if the approved
 * test wallet doesn't hold NGN.
 */
const code = (process.env.NEXT_PUBLIC_DEFAULT_CURRENCY ?? "NGN").trim().toUpperCase();

export const DEFAULT_ASSET = {
  assetCode: /^[A-Z]{3}$/.test(code) ? code : "NGN",
  assetScale: 2,
} as const;
